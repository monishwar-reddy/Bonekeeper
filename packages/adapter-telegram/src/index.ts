import { Telegraf } from 'telegraf';
import { ModerationPipeline, LLMClassifier, InMemoryStorage, GroupConfig } from '@bonekeeper/core';
import { TelegramAdapter } from './adapter';
import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const bot = new Telegraf(BOT_TOKEN);
const classifier = new LLMClassifier(ANTHROPIC_API_KEY);
const storage = new InMemoryStorage();
const pipeline = new ModerationPipeline(classifier, storage);

// Default config for new groups
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
  dryRun: true, // Enable dry-run for first 48 hours
  enableRepeatOffenderAction: true
});

bot.on('text', async (ctx) => {
  if (!ctx.chat || ctx.chat.type === 'private') {
    return;
  }

  const message = TelegramAdapter.normalizeMessage(ctx);
  if (!message) {
    return;
  }

  // Get or create group config
  let config = await storage.getGroupConfig(message.groupId);
  if (!config) {
    config = getDefaultConfig(message.groupId);
    await storage.saveGroupConfig(config);
  }

  const adapter = new TelegramAdapter(bot, ctx);
  const result = await pipeline.moderate(message, config, adapter);

  console.log(`Moderation result for message ${message.id}:`, result);
});

// Admin commands
bot.command('bonekeeper_config', async (ctx) => {
  if (!ctx.chat) return;

  const config = await storage.getGroupConfig(ctx.chat.id.toString());
  if (!config) {
    await ctx.reply('No config found. Send a message to initialize.');
    return;
  }

  await ctx.reply(
    `⚰️ Bonekeeper Config\n\n` +
    `Strictness: ${config.strictness}\n` +
    `Dry-run: ${config.dryRun ? '✅' : '❌'}\n` +
    `Delete non-admin links: ${config.deleteLinksFromNonAdmins ? '✅' : '❌'}\n` +
    `Allowlisted users: ${config.allowlist.users.length}\n` +
    `Allowlisted domains: ${config.allowlist.domains.length}`
  );
});

bot.command('bonekeeper_dryrun', async (ctx) => {
  if (!ctx.chat) return;

  const config = await storage.getGroupConfig(ctx.chat.id.toString());
  if (!config) return;

  config.dryRun = !config.dryRun;
  await storage.saveGroupConfig(config);

  await ctx.reply(`Dry-run mode ${config.dryRun ? 'enabled ✅' : 'disabled ❌'}`);
});

bot.launch();
console.log('🦴 Bonekeeper Telegram bot started');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
