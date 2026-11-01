import { Client, GatewayIntentBits, Events } from 'discord.js';
import { ModerationPipeline, LLMClassifier, InMemoryStorage, GroupConfig } from '@bonekeeper/core';
import { DiscordAdapter } from './adapter';
import * as dotenv from 'dotenv';

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const classifier = new LLMClassifier(ANTHROPIC_API_KEY);
const storage = new InMemoryStorage();
const pipeline = new ModerationPipeline(classifier, storage);

const getDefaultConfig = (groupId: string): GroupConfig => ({
  groupId,
  description: 'General community discussion',
  strictness: 'balanced',
  allowlist: {
    users: [],
    domains: []
  },
  deleteLinksFromNonAdmins: false,
  requireAdminApproval: false,
  dryRun: true,
  enableRepeatOffenderAction: true
});

client.on(Events.MessageCreate, async (msg) => {
  if (!msg.guild || msg.author.bot) {
    return;
  }

  const message = DiscordAdapter.normalizeMessage(msg);
  if (!message) {
    return;
  }

  let config = await storage.getGroupConfig(message.groupId);
  if (!config) {
    config = getDefaultConfig(message.groupId);
    await storage.saveGroupConfig(config);
  }

  const adapter = new DiscordAdapter(client, msg);
  const result = await pipeline.moderate(message, config, adapter);

  console.log(`Moderation result for message ${message.id}:`, result);
});

client.on(Events.ClientReady, () => {
  console.log('🦴 Bonekeeper Discord bot started');
});

client.login(DISCORD_TOKEN);
