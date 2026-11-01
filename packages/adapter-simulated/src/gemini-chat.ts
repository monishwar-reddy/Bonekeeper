import { BotPersona } from './personas';

export interface ChatContext {
  recentMessages: Array<{ sender: string; text: string }>;
  humanMessage?: string; // if the human just posted, bots can reply to it
}

/**
 * Generate a bot's next message using Gemini.
 * Falls back to a random scripted line when Gemini is unavailable.
 */
export async function generateBotMessage(
  persona: BotPersona,
  ctx: ChatContext,
  apiKey: string
): Promise<string> {
  if (!apiKey) return pickScripted(persona);

  const history = ctx.recentMessages
    .slice(-8)
    .map(m => `${m.sender}: ${m.text}`)
    .join('\n');

  const replyHint = ctx.humanMessage
    ? `\nThe human user just said: "${ctx.humanMessage}" — you may respond to it.`
    : '';

  const prompt = `${persona.systemPrompt}${replyHint}

Recent chat history:
${history || '(chat just started)'}

Write your next message as ${persona.name}. Under 25 words. Plain text only, no quotes.`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/^["']|["']$/g, '');
    return text || pickScripted(persona);
  } catch {
    return pickScripted(persona);
  }
}

function pickScripted(persona: BotPersona): string {
  const lines = persona.scriptedLines;
  return lines[Math.floor(Math.random() * lines.length)];
}
