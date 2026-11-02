import { ModerationPipeline, LLMClassifier, InMemoryStorage, Message, ModerationAction, AuditRecord } from '@/vendor/core/index';
import { SimulatedAdapter, SimulatedEvent } from '@/vendor/adapter-simulated/adapter';
import { v4 as uuidv4 } from 'uuid';
import { getGroupConfig, getCorrections, ChatMessage } from './store';

// Import the low-level read/write directly so we can batch updates
import { _batchWrite } from './store';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const classifier = new LLMClassifier(GEMINI_KEY);
const storage    = new InMemoryStorage();
const pipeline   = new ModerationPipeline(classifier, storage);

export async function moderateMessage(msg: Message): Promise<ModerationAction> {
  const adapter = new SimulatedAdapter();
  const config  = await getGroupConfig();
  const action  = await pipeline.moderate(msg, config, adapter);
  const events  = adapter.getEvents();

  // Build all mutations then apply in ONE write to avoid Blobs race conditions
  const mutations: Parameters<typeof _batchWrite>[0] = {};

  if (action.type === 'delete' || action.type === 'quarantine') {
    mutations.messageStatusUpdate = {
      id: msg.id,
      status: action.type === 'quarantine' ? 'held' : 'deleted',
      message: { ...msg, status: action.type === 'quarantine' ? 'held' : 'deleted' },
    };
  }

  if (action.type !== 'allow') {
    mutations.auditRecord = {
      id: uuidv4(), messageId: msg.id, groupId: msg.groupId, platform: msg.platform,
      senderId: msg.sender.id, senderName: msg.sender.name, messageText: msg.text,
      category: action.category || 'fine', confidence: action.confidence || 0,
      reason: action.reason, action: action.type === 'quarantine' ? 'held' : action.type,
      reviewStatus: 'pending', timestamp: new Date(),
    } as AuditRecord;
  }

  for (const ev of events) {
    if (ev.type === 'delete' && !mutations.messageStatusUpdate) {
      mutations.messageStatusUpdate = { id: ev.messageId, status: action.type === 'quarantine' ? 'held' : 'deleted' };
    }
    if (ev.type === 'warn') {
      mutations.userUpsert = { id: ev.userId, name: msg.sender.name, role: msg.sender.isBot ? 'bot' : 'member', botKind: msg.sender.botKind, warnings: ev.warningCount };
      mutations.warningChip = {
        id: uuidv4(), platform: msg.platform, groupId: msg.groupId,
        sender: { id: 'system', name: 'Bonekeeper', role: 'admin', joinedAt: new Date() },
        text: `⚠️ Warning ${ev.warningCount}/3 to ${msg.sender.name}: ${ev.reason}`,
        links: [], isForwarded: false, timestamp: new Date(), status: 'ok',
        warningChip: `Warning ${ev.warningCount}/3 to ${msg.sender.name}: ${ev.reason}`,
      } as ChatMessage;
    }
    if (ev.type === 'mute') {
      mutations.userUpsert = { id: ev.userId, name: msg.sender.name, role: 'bot', botKind: msg.sender.botKind, warnings: 0, mutedUntil: ev.until.toISOString() };
      mutations.muteChip = {
        id: uuidv4(), platform: msg.platform, groupId: msg.groupId,
        sender: { id: 'system', name: 'Bonekeeper', role: 'admin', joinedAt: new Date() },
        text: `🔇 ${msg.sender.name} muted for 30s after 3 violations`,
        links: [], isForwarded: false, timestamp: new Date(), status: 'ok',
        warningChip: `muted:${ev.userId}`,
      } as ChatMessage;
    }
  }

  await _batchWrite(mutations);
  return action;
}

export async function syncCorrectionsToClassifier() {
  const corrections = await getCorrections(10);
  classifier.setCorrections(corrections);
}
