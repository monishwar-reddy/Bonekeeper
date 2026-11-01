import { ModerationPipeline, LLMClassifier, InMemoryStorage, Message, ModerationAction, AuditRecord } from '@/vendor/core/index';
import { SimulatedAdapter, SimulatedEvent } from '@/vendor/adapter-simulated/adapter';
import { v4 as uuidv4 } from 'uuid';
import { getGroupConfig, addAuditRecord, updateMessageStatus, addWarningChip, getUser, upsertUser, getCorrections, ChatMessage } from './store';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const classifier = new LLMClassifier(GEMINI_KEY);
const storage    = new InMemoryStorage();
const pipeline   = new ModerationPipeline(classifier, storage);

export async function moderateMessage(msg: Message): Promise<ModerationAction> {
  const adapter = new SimulatedAdapter();
  const config  = await getGroupConfig();
  const action  = await pipeline.moderate(msg, config, adapter);
  for (const ev of adapter.getEvents()) await handleEvent(ev, msg, action);
  if (action.type !== 'allow') {
    await addAuditRecord({
      id: uuidv4(), messageId: msg.id, groupId: msg.groupId, platform: msg.platform,
      senderId: msg.sender.id, senderName: msg.sender.name, messageText: msg.text,
      category: action.category || 'fine', confidence: action.confidence || 0,
      reason: action.reason, action: action.type === 'quarantine' ? 'held' : action.type,
      reviewStatus: 'pending', timestamp: new Date(),
    } as AuditRecord);
  }
  return action;
}

async function handleEvent(ev: SimulatedEvent, msg: Message, action: ModerationAction) {
  if (ev.type === 'delete') await updateMessageStatus(ev.messageId, action.type === 'quarantine' ? 'held' : 'deleted');
  if (ev.type === 'warn') {
    const ex = await getUser(ev.userId);
    await upsertUser({ id:ev.userId, name:msg.sender.name, role:msg.sender.isBot?'bot':'member', botKind:msg.sender.botKind, warnings:ev.warningCount, mutedUntil:ex?.mutedUntil });
    await addWarningChip({ id:uuidv4(), platform:msg.platform, groupId:msg.groupId, sender:{id:'system',name:'Bonekeeper',role:'admin',joinedAt:new Date()}, text:`⚠️ Warning ${ev.warningCount}/3 to ${msg.sender.name}: ${ev.reason}`, links:[], isForwarded:false, timestamp:new Date(), status:'ok', warningChip:`Warning ${ev.warningCount}/3 to ${msg.sender.name}: ${ev.reason}` } as ChatMessage);
  }
  if (ev.type === 'mute') {
    await upsertUser({ id:ev.userId, name:msg.sender.name, role:'bot', botKind:msg.sender.botKind, warnings:0, mutedUntil:ev.until.toISOString() });
    await addWarningChip({ id:uuidv4(), platform:msg.platform, groupId:msg.groupId, sender:{id:'system',name:'Bonekeeper',role:'admin',joinedAt:new Date()}, text:`🔇 ${msg.sender.name} muted for 30s after 3 violations`, links:[], isForwarded:false, timestamp:new Date(), status:'ok', warningChip:`muted:${ev.userId}` } as ChatMessage);
  }
}

export async function syncCorrectionsToClassifier() {
  classifier.setCorrections(await getCorrections(10));
}
