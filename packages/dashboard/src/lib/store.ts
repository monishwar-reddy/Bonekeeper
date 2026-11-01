import { AuditRecord, GroupConfig, CorrectionRecord, ModerationCategory, ReviewStatus, Message } from '@/vendor/core/types';
import { v4 as uuidv4 } from 'uuid';

export type ChatMessage = Message & { status: 'ok'|'deleted'|'held'|'restored'; warningChip?: string; };
export interface UserRecord { id: string; name: string; role: 'admin'|'member'|'bot'; botKind?: 'positive'|'negative'; color?: string; warnings: number; mutedUntil?: string|null; }

interface AppState {
  messages: ChatMessage[]; audit: AuditRecord[]; corrections: CorrectionRecord[];
  users: Record<string, UserRecord>; config: GroupConfig;
  lastTickAt: number; lastHumanMessage?: string;
}

const DEFAULT_CONFIG: GroupConfig = {
  groupId:'halloween-dev-club', description:'A developer community chat about coding, open source, and software engineering',
  strictness:'balanced', allowlist:{users:[],domains:[],phrases:[]},
  deleteLinksFromNonAdmins:false, requireAdminApproval:false, dryRun:false,
  enableRepeatOffenderAction:true, pauseBots:false,
};

const SEED: ChatMessage[] = [
  { id:'seed-1', platform:'simulated', groupId:'halloween-dev-club', sender:{id:'system',name:'Bonekeeper',role:'admin',joinedAt:new Date(0)}, text:'👻 Welcome to Halloween Dev Club! Bonekeeper is watching.', links:[], isForwarded:false, timestamp:new Date(), status:'ok' },
  { id:'seed-2', platform:'simulated', groupId:'halloween-dev-club', sender:{id:'luna',name:'Luna',role:'member',joinedAt:new Date(0),isBot:true,botKind:'positive'}, text:'Hey everyone! Ready to code something spooky tonight? 🎃', links:[], isForwarded:false, timestamp:new Date(), status:'ok' },
];

function empty(): AppState { return { messages:[...SEED], audit:[], corrections:[], users:{}, config:DEFAULT_CONFIG, lastTickAt:0 }; }

// ── Netlify Blobs / local fallback ────────────────────────────
const STORE = 'bonekeeper', KEY = 'state';
function isNetlify() { return !!(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_LOCAL); }

async function read(): Promise<AppState> {
  if (!isNetlify()) return local();
  try {
    const { getStore } = await import('@netlify/blobs');
    const raw = await getStore(STORE).get(KEY, { type:'json' }) as AppState|null;
    if (!raw) return empty();
    raw.messages = (raw.messages||[]).map(m => ({ ...m, timestamp:new Date(m.timestamp), sender:{...m.sender,joinedAt:new Date(m.sender.joinedAt)} }));
    raw.audit    = (raw.audit||[]).map(r => ({ ...r, timestamp:new Date(r.timestamp), reviewedAt:r.reviewedAt?new Date(r.reviewedAt):undefined }));
    raw.corrections = (raw.corrections||[]).map(c => ({ ...c, createdAt:new Date(c.createdAt) }));
    return raw;
  } catch { return local(); }
}

async function write(s: AppState) {
  if (!isNetlify()) { _mem = s; return; }
  try { const { getStore } = await import('@netlify/blobs'); await getStore(STORE).setJSON(KEY, s); } catch { /* ignore */ }
}

let _mem: AppState|null = null;
function local(): AppState { if (!_mem) _mem = empty(); return _mem; }

// ── Public API ────────────────────────────────────────────────
export async function getMessages() { return (await read()).messages; }
export async function getMessagesAfter(afterId: string) {
  const msgs = (await read()).messages;
  if (!afterId) return msgs;
  const i = msgs.findIndex(m => m.id === afterId);
  return i === -1 ? msgs : msgs.slice(i+1);
}
export async function addChatMessage(msg: ChatMessage) {
  const s = await read(); s.messages.push(msg);
  if (s.messages.length > 500) s.messages = s.messages.slice(-500);
  await write(s);
}
export async function updateMessageStatus(id: string, status: ChatMessage['status']) {
  const s = await read(); const m = s.messages.find(m=>m.id===id); if(m){m.status=status; await write(s);}
}
export async function addWarningChip(chip: ChatMessage) { await addChatMessage(chip); }
export async function getLastHumanMessage() { return (await read()).lastHumanMessage; }
export async function setLastHumanMessage(t: string|undefined) { const s=await read(); s.lastHumanMessage=t; await write(s); }
export async function getRecentMessages(n=8) {
  return (await read()).messages.filter(m=>m.status==='ok'||m.status==='restored').slice(-n).map(m=>({sender:m.sender.name,text:m.text}));
}
export async function getUser(id: string) { return (await read()).users[id]; }
export async function upsertUser(u: UserRecord) { const s=await read(); s.users[u.id]=u; await write(s); }
export async function getAllUsers() { return Object.values((await read()).users); }
export async function addAuditRecord(r: AuditRecord) { const s=await read(); s.audit.push(r); await write(s); }
export async function getAuditRecords() { return (await read()).audit; }
export async function updateAuditReview(id: string, status: ReviewStatus, by: string) {
  const s=await read(); const r=s.audit.find(r=>r.id===id); if(r){r.reviewStatus=status;r.reviewedBy=by;r.reviewedAt=new Date(); await write(s);}
}
export async function addCorrection(text: string, wrong: ModerationCategory, correct: ModerationCategory) {
  const s=await read(); s.corrections.push({id:uuidv4(),text,wrongCategory:wrong,correctCategory:correct,createdAt:new Date()});
  if(s.corrections.length>100)s.corrections.shift(); await write(s);
}
export async function getCorrections(limit=10) { return (await read()).corrections.slice(-limit); }
export async function getGroupConfig() { return (await read()).config; }
export async function updateGroupConfig(patch: Partial<GroupConfig>) { const s=await read(); s.config={...s.config,...patch}; await write(s); }
export async function shouldAllowTick(minGap=3000) {
  const s=await read(); const now=Date.now(); if(now-s.lastTickAt<minGap)return false; s.lastTickAt=now; await write(s); return true;
}
