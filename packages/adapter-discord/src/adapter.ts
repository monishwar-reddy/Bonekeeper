import { PlatformAdapter, AdapterCapabilities, Message, UserRole } from '@bonekeeper/core';
import { Client, Message as DiscordMessage, PermissionFlagsBits } from 'discord.js';

export class DiscordAdapter implements PlatformAdapter {
  constructor(
    private client: Client,
    private message: DiscordMessage
  ) {}

  async delete(messageId: string): Promise<void> {
    try {
      const msg = await this.message.channel.messages.fetch(messageId);
      await msg.delete();
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }

  async hide(messageId: string): Promise<void> {
    // Discord doesn't have a hide feature, fall back to delete
    await this.delete(messageId);
  }

  async warn(userId: string, reason: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      await user.send(`⚠️ Warning: ${reason}`);
    } catch (error) {
      console.error('Failed to warn user:', error);
    }
  }

  async notifyAdmins(text: string): Promise<void> {
    try {
      if (!this.message.guild) return;

      const members = await this.message.guild.members.fetch();
      const admins = members.filter(member => 
        member.permissions.has(PermissionFlagsBits.Administrator)
      );

      for (const [, admin] of admins) {
        try {
          await admin.send(`🔔 ${text}`);
        } catch {
          // Admin might have DMs disabled
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

  static normalizeMessage(msg: DiscordMessage): Message | null {
    if (!msg.content || !msg.guild || msg.author.bot) {
      return null;
    }

    const role = this.getUserRole(msg);
    const links = this.extractLinks(msg.content);

    return {
      id: msg.id,
      platform: 'discord',
      groupId: msg.channelId,
      sender: {
        id: msg.author.id,
        name: msg.author.username,
        role,
        joinedAt: msg.member?.joinedAt || new Date()
      },
      text: msg.content,
      links,
      isForwarded: false, // Discord doesn't have forwarding
      timestamp: msg.createdAt
    };
  }

  private static getUserRole(msg: DiscordMessage): UserRole {
    if (!msg.member) return 'member';

    if (msg.guild?.ownerId === msg.author.id) {
      return 'owner';
    }

    if (msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return 'admin';
    }

    if (msg.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return 'moderator';
    }

    return 'member';
  }

  private static extractLinks(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return text.match(urlRegex) || [];
  }
}
