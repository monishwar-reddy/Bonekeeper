/**
 * Telegram Bot webhook — App #2 on the same core.
 * Normalises Telegram updates into core Message objects, runs them through
 * the same moderation pipeline, and acts via the Bot API.
 *
 * Env vars (set in Netlify dashboard, never in files):
 *   TELEGRAM_BOT_TOKEN         — from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET    — any random string, set when calling setWebhook
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  ModerationPipeline,
  LLMClassifier,
  InMemoryStorage,
  PlatformAdapter,
  AdapterCapabilities,
  Message,
  ModerationAction,
  AuditRecord,
  GroupConfig,
} from '@/vendor/core/index';
import { isProtectedSender } from '@/vendor/core/protected-senders';
import { addAuditRecord, getGroupConfig, getCorrections, updateGroupConfig } from '@/lib/store';
import { syncCorrectionsToClassifier } from '@/lib/moderator';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET   = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const GEMINI_KEY       = process.env.GEMINI_API_KEY || '';

// Reuse classifier across requests (module-level singleton)
const classifier = new LLMClassifier(GEMINI_KEY);
const storage    = new InMemoryStorage();
const pipeline   = new ModerationPipeline(classifier, storage);

// ── Telegram Bot API helper ──────────────────────────────────

async function tgApi(method: string, body: object) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch { /* fail silently — never crash on Telegram errors */ }
}

// ── Telegram PlatformAdapter ─────────────────────────────────

class TelegramAdapter implements PlatformAdapter {
  private chatId: number;
  constructor(chatId: number) { this.chatId = chatId; }

  async delete(messageId: string) {
    await tgApi('deleteMessage', { chat_id: this.chatId, message_id: parseInt(messageId) });
  }
  async hide(messageId: string) {
    // Telegram can't hide — notify admins instead (capabilities reports canHide: false)
    await this.notifyAdmins(`Message ${messageId} held for review.`);
  }
  async warn(userId: string, reason: string) {
    await tgApi('sendMessage', {
      chat_id: this.chatId,
      text: `⚠️ Warning to user ${userId}: ${reason}`,
    });
  }
  async notifyAdmins(text: string) {
    await tgApi('sendMessage', { chat_id: this.chatId, text: `🔔 Admin notice: ${text}` });
  }
  capabilities(): AdapterCapabilities {
    return { canDelete: true, canHide: false, canWarn: true, canMute: false, canKick: false };
  }
}

// ── Normalise Telegram update → core Message ─────────────────

type TgRole = 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';

function tgRoleToCore(status: TgRole): 'admin' | 'member' {
  return status === 'creator' || status === 'administrator' ? 'admin' : 'member';
}

async function getRoleFromTelegram(chatId: number, userId: number): Promise<'admin' | 'member'> {
  if (!BOT_TOKEN) return 'member';
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${userId}`
    );
    const data = await res.json();
    if (data.ok) return tgRoleToCore(data.result.status);
  } catch { /* fail open */ }
  return 'member';
}

function normaliseMessage(update: any, role: 'admin' | 'member'): Message | null {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return null;

  const from   = msg.from;
  const chatId = msg.chat.id;

  // Anonymous admin posts (sender_chat === chat) → treat as admin
  const isAnonAdmin = msg.sender_chat && msg.sender_chat.id === chatId;
  const effectiveRole = isAnonAdmin ? 'admin' : role;

  return {
    id: String(msg.message_id),
    platform: 'telegram',
    groupId: String(chatId),
    sender: {
      id: String(from?.id || 'anon'),
      name: from ? `${from.first_name || ''}${from.last_name ? ' ' + from.last_name : ''}`.trim() : 'Anonymous',
      role: effectiveRole,
      joinedAt: new Date(msg.date * 1000 - 3_600_000), // approximate: joined ~1h before first message
    },
    text: msg.text,
    links: (msg.text.match(/https?:\/\/[^\s]+/g) || []),
    isForwarded: !!(msg.forward_date),
    timestamp: new Date(msg.date * 1000),
  };
}

// ── Main handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-telegram-bot-api-secret-token') || '';
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: any;
  try { update = await req.json(); } catch { return NextResponse.json({ ok: false }); }

  const tgMsg = update.message || update.edited_message;
  if (!tgMsg || !tgMsg.text || !tgMsg.chat) return NextResponse.json({ ok: true });

  // Only handle group/supergroup messages
  const chatType = tgMsg.chat.type;
  if (chatType === 'private') return NextResponse.json({ ok: true });

  const chatId = tgMsg.chat.id;
  const userId = tgMsg.from?.id;

  // Get sender role from Telegram
  const role = userId ? await getRoleFromTelegram(chatId, userId) : 'member';
  const msg  = normaliseMessage(update, role);
  if (!msg) return NextResponse.json({ ok: true });

  // Sync corrections into classifier
  await syncCorrectionsToClassifier();

  const config = await getGroupConfig();

  // Séance mode override for Telegram — first-time groups start dry-run
  const tgConfig: GroupConfig = { ...config, groupId: String(chatId) };

  const adapter = new TelegramAdapter(chatId);

  // Run through pipeline (protected senders are checked inside pipeline)
  const action = await pipeline.moderate(msg, tgConfig, adapter);

  // Audit log (same table, platform = 'telegram')
  if (action.type !== 'allow') {
    const record: AuditRecord = {
      id: uuidv4(),
      messageId: msg.id,
      groupId:   msg.groupId,
      platform:  'telegram',
      senderId:  msg.sender.id,
      senderName: msg.sender.name,
      messageText: msg.text,
      category:  action.category || 'fine',
      confidence: action.confidence || 0,
      reason:    action.reason,
      action:    action.type === 'quarantine' ? 'held' : action.type,
      reviewStatus: 'pending',
      timestamp: new Date(),
    };
    await addAuditRecord(record);
  }

  return NextResponse.json({ ok: true });
}
