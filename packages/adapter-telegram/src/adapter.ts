import { PlatformAdapter, AdapterCapabilities, Message, UserRole } from '@bonekeeper/core';
import { Context, Telegraf } from 'telegraf';

export class TelegramAdapter implements PlatformAdapter {
  constructor(private bot: Telegraf, private ctx: Context) {}

  async delete(messageId: string): Promise<void> {
    try {
      const [chatId, msgId] = messageId.split(':');
      await this.bot.telegram.deleteMessage(chatId, parseInt(msgId));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }

  async hide(messageId: string): Promise<void> {
    // Telegram doesn't have a hide feature, fall back to delete
    await this.delete(messageId);
  }

  async warn(userId: string, reason: string): Promise<void> {
    try {
      const chatId = this.ctx.chat?.id;
      if (!chatId) return;

      await this.bot.telegram.sendMessage(
        chatId,
        `⚠️ Warning for user ${userId}: ${reason}`
      );
    } catch (error) {
      console.error('Failed to warn user:', error);
    }
  }

  async notifyAdmins(text: string): Promise<void> {
    try {
      const chatId = this.ctx.chat?.id;
      if (!chatId) return;

      const admins = await this.bot.telegram.getChatAdministrators(chatId);
      for (const admin of admins) {
        try {
          await this.bot.telegram.sendMessage(admin.user.id, `🔔 ${text}`);
        } catch {
          // Admin might have blocked the bot
        }
      }
    } catch (error) {
      console.error('Failed to notify admins:', error);
    }
  }

  capabilities(): AdapterCapabilities {
    return {
      canDelete: true,
      canHide: false,
      canWarn: true,
      canMute: true,
      canKick: true
    };
  }

  static normalizeMessage(ctx: Context): Message | null {
    if (!ctx.message || !('text' in ctx.message) || !ctx.from || !ctx.chat) {
      return null;
    }

    const role = this.getUserRole(ctx);
    const links = this.extractLinks(ctx.message.text);

    return {
      id: `${ctx.chat.id}:${ctx.message.message_id}`,
      platform: 'telegram',
      groupId: ctx.chat.id.toString(),
      sender: {
        id: ctx.from.id.toString(),
        name: ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
        role,
        joinedAt: new Date(ctx.from.id * 1000) // Approximation
      },
      text: ctx.message.text,
      links,
      isForwarded: 'forward_date' in ctx.message,
      timestamp: new Date(ctx.message.date * 1000)
    };
  }

  private static getUserRole(ctx: Context): UserRole {
    // This would need to be cached from getChatMember calls
    // For simplicity, defaulting to member
    return 'member';
  }

  private static extractLinks(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return text.match(urlRegex) || [];
  }
}
