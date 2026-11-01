import { BotPersona } from './personas';
export interface ChatContext { recentMessages: Array<{ sender: string; text: string }>; humanMessage?: string; }

export async function generateBotMessage(persona: BotPersona, ctx: ChatContext, apiKey: string): Promise<string> {
  if (!apiKey) return pick(persona);
  const history = ctx.recentMessages.slice(-8).map(m => `${m.sender}: ${m.text}`).join('\n');
  const hint = ctx.humanMessage ? `\nThe human just said: "${ctx.humanMessage}" — you may respond.` : '';
  const prompt = `${persona.systemPrompt}${hint}\n\nRecent chat:\n${history || '(just started)'}\n\nWrite next message as ${persona.name}. Under 25 words. Plain text only.`;
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const r = await new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash' }).generateContent(prompt);
    return r.response.text().trim().replace(/^["']|["']$/g,'') || pick(persona);
  } catch { return pick(persona); }
}

function pick(p: BotPersona) { return p.scriptedLines[Math.floor(Math.random() * p.scriptedLines.length)]; }
