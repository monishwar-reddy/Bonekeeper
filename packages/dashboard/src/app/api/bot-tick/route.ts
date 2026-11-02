import { NextRequest, NextResponse } from 'next/server';
import { getGroupConfig, getRecentMessages, getLastHumanMessage, setLastHumanMessage, upsertUser, getUser, addChatMessage, updateMessageStatus, shouldAllowTick, ChatMessage } from '@/lib/store';
import { moderateMessage } from '@/lib/moderator';
import { PERSONAS } from '@/vendor/adapter-simulated/personas';
import { generateBotMessage } from '@/vendor/adapter-simulated/gemini-chat';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

const tickRates = new Map<string, { count: number; resetAt: number }>();
function checkTickRate(ip: string) {
  const now = Date.now(); let r = tickRates.get(ip);
  if (!r || r.resetAt < now) { r = { count:0, resetAt:now+10_000 }; tickRates.set(ip,r); }
  return ++r.count <= 4;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  if (!checkTickRate(ip)) return NextResponse.json({ skipped:'rate' });
  if (!(await shouldAllowTick(3000))) return NextResponse.json({ skipped:'debounce' });
  const config = await getGroupConfig();
  if (config.pauseBots) return NextResponse.json({ paused:true });

  const kind: 'positive'|'negative' = Math.random() < 0.5 ? 'negative' : 'positive';
  const pool = PERSONAS.filter(p => p.kind === kind);
  const persona = pool[Math.floor(Math.random()*pool.length)];

  const existing = await getUser(persona.id);
  if (existing?.mutedUntil && new Date() < new Date(existing.mutedUntil)) return NextResponse.json({ muted:true });

  const text = await generateBotMessage(persona, { recentMessages: await getRecentMessages(), humanMessage: await getLastHumanMessage() }, GEMINI_KEY);
  await setLastHumanMessage(undefined);

  const msg = { id:uuidv4(), platform:'simulated', groupId:'halloween-dev-club',
    sender:{ id:persona.id, name:persona.name, role:'member' as const, joinedAt:new Date(Date.now()-3_600_000), isBot:true, botKind:persona.kind, warnings:existing?.warnings||0 },
    text, links:text.match(/https?:\/\/[^\s]+|(?:^|\s)(?:[a-z0-9-]+\.)+(?:com|org|net|io|xyz|tk|ml|ga|cf|click|top|work|zip)\b/gi)?.map(link => link.trim())||[], isForwarded:false, timestamp:new Date() };

  const chatMsg: ChatMessage = { ...msg, status:'ok' };
  const action = await moderateMessage(msg);
  if (action.type === 'allow' || action.type === 'warn') {
    await upsertUser({ id:persona.id, name:persona.name, role:'bot', botKind:persona.kind, color:persona.color, warnings:existing?.warnings||0, mutedUntil:existing?.mutedUntil });
    await addChatMessage(chatMsg);
  }
  return NextResponse.json({ id:msg.id, action:action.type, persona:persona.id });
}
