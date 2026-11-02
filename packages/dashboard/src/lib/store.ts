import { AuditRecord, GroupConfig, CorrectionRecord, ModerationCategory, ReviewStatus, Message } from '@/vendor/core/types';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';

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
  deleteLinksFromNonAdmins:true, requireAdminApproval:false, dryRun:false,
  enableRepeatOffenderAction:true, pauseBots:false,
};

const SEED: ChatMessage[] = [
  { id:'seed-1', platform:'simulated', groupId:'halloween-dev-club', sender:{id:'system',name:'Bonekeeper',role:'admin',joinedAt:new Date(0)}, text:'👻 Welcome to Halloween Dev Club! Bonekeeper is watching.', links:[], isForwarded:false, timestamp:new Date(), status:'ok' },
  { id:'seed-2', platform:'simulated', groupId:'halloween-dev-club', sender:{id:'luna',name:'Luna',role:'member',joinedAt:new Date(0),isBot:true,botKind:'positive'}, text:'Hey everyone! Ready to code something spooky tonight? 🎃', links:[], isForwarded:false, timestamp:new Date(), status:'ok' },
];

function empty(): AppState { return { messages:[...SEED], audit:[], corrections:[], users:{}, config:DEFAULT_CONFIG, lastTickAt:0 }; }

// ── Netlify Blobs / local fallback ────────────────────────────
const STORE = 'bonekeeper';
const SESSION_COOKIE = 'bk_session';
const DEFAULT_SESSION = 'anonymous';

function sessionKey(): string {
  let value = DEFAULT_SESSION;
  try {
    value = cookies().get(SESSION_COOKIE)?.value || DEFAULT_SESSION;
  } catch {
    // Unit tests and local utilities may run without a Next request context.
  }
  return /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? `state:${value}` : `state:${DEFAULT_SESSION}`;
}
function isNetlify() {
  // NETLIFY_BLOBS_CONTEXT is injected at runtime by the Next.js Netlify plugin
  // NETLIFY is set during build. Either means we're on Netlify infrastructure.
  return !!(
    process.env.NETLIFY_BLOBS_CONTEXT ||
    process.env.NETLIFY ||
    process.env.NETLIFY_LOCAL ||
    process.env.SITE_ID // also set by the plugin
  );
}

async function read(): Promise<AppState> {
  if (!isNetlify()) return local();
  try {
    const { getStore } = await import('@netlify/blobs');
    const raw = await getStore(STORE).get(sessionKey(), { type:'json' }) as AppState|null;
    if (!raw) return empty();
    raw.messages = (raw.messages||[]).map(m => ({ ...m, timestamp:new Date(m.timestamp), sender:{...m.sender,joinedAt:new Date(m.sender.joinedAt)} }));
    raw.audit    = (raw.audit||[]).map(r => ({ ...r, timestamp:new Date(r.timestamp), reviewedAt:r.reviewedAt?new Date(r.reviewedAt):undefined }));
    raw.corrections = (raw.corrections||[]).map(c => ({ ...c, createdAt:new Date(c.createdAt) }));
    return raw;
  } catch (e) {
    console.error('[store] blob read failed, using memory:', e);
    return local();
  }
}

async function write(s: AppState) {
  if (!isNetlify()) { memoryStates.set(sessionKey(), s); return; }
  try {
    const { getStore } = await import('@netlify/blobs');
    await getStore(STORE).setJSON(sessionKey(), s);
  } catch (e) {
    // Fall back to memory so the request doesn't fail silently
    memoryStates.set(sessionKey(), s);
    console.error('[store] blob write failed, using memory:', e);
  }
}

const memoryStates = new Map<string, AppState>();
function local(): AppState {
  const key = sessionKey();
  let state = memoryStates.get(key);
  if (!state) {
    state = empty();
    memoryStates.set(key, state);
  }
  return state;
}
export function _resetMemory() { memoryStates.clear(); }

export async function resetState() {
  const fresh = empty();
  if (!isNetlify()) {
    memoryStates.set(sessionKey(), fresh);
    return;
  }
  const { getStore } = await import('@netlify/blobs');
  await getStore(STORE).setJSON(sessionKey(), fresh);
}

// ── Atomic batch write — ONE read + ONE write ─────────────────
export interface BatchMutations {
  messageStatusUpdate?: { id: string; status: ChatMessage['status']; message?: ChatMessage };
  auditRecord?: AuditRecord;
  userUpsert?: UserRecord;
  warningChip?: ChatMessage;
  muteChip?: ChatMessage;
}

export async function _batchWrite(m: BatchMutations): Promise<void> {
  if (Object.keys(m).length === 0) return;
  const s = await read();
  if (m.messageStatusUpdate) {
    const msg = s.messages.find(x => x.id === m.messageStatusUpdate!.id);
    if (msg) msg.status = m.messageStatusUpdate.status;
    else if (m.messageStatusUpdate.message) {
      s.messages.push({ ...m.messageStatusUpdate.message, status: m.messageStatusUpdate.status });
    }
  }
  if (m.auditRecord) s.audit.push(m.auditRecord);
  if (m.userUpsert) s.users[m.userUpsert.id] = m.userUpsert;
  if (m.warningChip) { s.messages.push(m.warningChip); if (s.messages.length > 500) s.messages = s.messages.slice(-500); }
  if (m.muteChip)    { s.messages.push(m.muteChip);    if (s.messages.length > 500) s.messages = s.messages.slice(-500); }
  await write(s);
}

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
export async function decrementUserWarning(userId: string) {
  const s = await read(); const u = s.users[userId];
  if (u && u.warnings > 0) { u.warnings -= 1; await write(s); }
}
export async function setUserWarning(userId: string, count: number) {
  const s = await read(); const u = s.users[userId];
  if (u) { u.warnings = Math.max(0, count); await write(s); }
}
export async function addAuditRecord(r: AuditRecord) { const s=await read(); s.audit.push(r); await write(s); }
export async function getAuditRecords() { return (await read()).audit; }
export async function updateAuditRecord(id: string, patch: Partial<AuditRecord>) {
  const s = await read(); const r = s.audit.find(a => a.id === id);
  if (r) { Object.assign(r, patch); await write(s); }
}
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
