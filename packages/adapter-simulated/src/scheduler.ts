import { PERSONAS, BotPersona } from './personas';
import { generateBotMessage } from './gemini-chat';
import { Message, UserRole } from '@bonekeeper/core';
import { v4 as uuidv4 } from 'uuid';

const GROUP_ID = 'halloween-dev-club';
const PLATFORM = 'simulated';

function extractLinks(text: string): string[] {
  return (text.match(/https?:\/\/[^\s]+/g) || []);
}

function buildMessage(persona: BotPersona, text: string): Message {
  return {
    id: uuidv4(),
    platform: PLATFORM,
    groupId: GROUP_ID,
    sender: {
      id: persona.id,
      name: persona.name,
      role: 'member' as UserRole,
      joinedAt: new Date(Date.now() - 60 * 60 * 1000), // joined 1h ago
      isBot: true,
      botKind: persona.kind,
      warnings: 0,
    },
    text,
    links: extractLinks(text),
    isForwarded: false,
    timestamp: new Date(),
  };
}

export interface SchedulerCallbacks {
  onMessage: (message: Message) => Promise<void>;
  isPaused: () => boolean;
  getRecentMessages: () => Array<{ sender: string; text: string }>;
  getLastHumanMessage: () => string | undefined;
}

export class BotScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  start(callbacks: SchedulerCallbacks, intervalMs = 4000): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      if (callbacks.isPaused()) return;

      // 50% chance pick a negative bot, otherwise pick a positive bot
      const pool = Math.random() < 0.5
        ? PERSONAS.filter(p => p.kind === 'negative')
        : PERSONAS.filter(p => p.kind === 'positive');

      const persona = pool[Math.floor(Math.random() * pool.length)];
      const text = await generateBotMessage(persona, {
        recentMessages: callbacks.getRecentMessages(),
        humanMessage: callbacks.getLastHumanMessage(),
      }, this.apiKey);

      const msg = buildMessage(persona, text);
      await callbacks.onMessage(msg);
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/** Build a Message from a human user posting in the simulated chat */
export function buildHumanMessage(text: string, role: UserRole, name = 'You'): Message {
  return {
    id: uuidv4(),
    platform: PLATFORM,
    groupId: GROUP_ID,
    sender: {
      id: 'human',
      name,
      role,
      joinedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      isBot: false,
      warnings: 0,
    },
    text,
    links: extractLinks(text),
    isForwarded: false,
    timestamp: new Date(),
  };
}
