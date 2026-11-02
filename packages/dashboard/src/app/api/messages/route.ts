import { NextRequest, NextResponse } from 'next/server';
import {
  getMessages,
  getMessagesAfter,
  addChatMessage,
  setLastHumanMessage,
  upsertUser,
  getUser,
  ChatMessage,
} from '@/lib/store';
import { moderateMessage } from '@/lib/moderator';
import { buildHumanMessage } from '@/vendor/adapter-simulated/scheduler';

export const dynamic = 'force-dynamic';

// Rate-limit sends per IP
const sendRates = new Map<string, { count: number; resetAt: number }>();
function checkSendRate(ip: string): boolean {
  const now = Date.now();
  let r = sendRates.get(ip);
  if (!r || r.resetAt < now) { r = { count: 0, resetAt: now + 10_000 }; sendRates.set(ip, r); }
  r.count++;
  return r.count <= 5; // 5 messages per 10s
}

export async function GET(req: NextRequest) {
  const after = req.nextUrl.searchParams.get('after') || '';
  const msgs = after ? await getMessagesAfter(after) : await getMessages();
  return NextResponse.json(msgs);
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkSendRate(ip)) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

    const { text, role = 'member' } = await req.json() as { text: string; role: string };
    if (!text?.trim()) return NextResponse.json({ error: 'empty' }, { status: 400 });

    const msg = buildHumanMessage(text.trim(), role as any, role === 'admin' ? 'Admin' : 'You');

    const chatMsg: ChatMessage = { ...msg, status: 'ok' };
    const action = await moderateMessage(msg);
    if (action.type === 'allow' || action.type === 'warn') {
      const existing = await getUser('human');
      await upsertUser({
        id: 'human',
        name: role === 'admin' ? 'Admin' : 'You',
        role: role as 'admin' | 'member',
        warnings: existing?.warnings || 0,
      });
      await setLastHumanMessage(text.trim());
      await addChatMessage(chatMsg);
    }
    return NextResponse.json({ id: msg.id, action: action.type });
  } catch (error) {
    console.error('[messages] failed to process message', error);
    return NextResponse.json({ error: 'Unable to process message' }, { status: 500 });
  }
}
