/**
 * Bonekeeper Adapter Template
 * Copy this file, rename it, fill in the TODOs, and you have a new platform adapter.
 * packages/core is NEVER modified — only this file imports from it.
 */
import {
  PlatformAdapter,
  AdapterCapabilities,
  Message,
  UserRole,
} from '../../packages/dashboard/src/vendor/core/types';

// ── 1. NORMALISE ─────────────────────────────────────────────
// Convert your platform's event object into a core Message.
export function normaliseMessage(platformEvent: any): Message | null {
  // TODO: extract id, text, sender, timestamp etc. from platformEvent
  return {
    id:         platformEvent.id,
    platform:   'your-platform',          // TODO: platform name
    groupId:    platformEvent.chatId,      // TODO: group/channel id
    sender: {
      id:       platformEvent.userId,
      name:     platformEvent.userName,
      role:     'member' as UserRole,      // TODO: map platform roles
      joinedAt: new Date(),
    },
    text:        platformEvent.text,
    links:       (platformEvent.text.match(/https?:\/\/[^\s]+/g) || []),
    isForwarded: false,                    // TODO: check forwarded flag
    timestamp:   new Date(platformEvent.ts),
  };
}

// ── 2. ADAPTER ───────────────────────────────────────────────
export class YourPlatformAdapter implements PlatformAdapter {
  constructor(private chatId: string) {}

  async delete(messageId: string): Promise<void> {
    // TODO: call platform API to delete the message
  }

  async hide(messageId: string): Promise<void> {
    // If your platform can't hide, fall back to delete or admin notify
    await this.delete(messageId);
  }

  async warn(userId: string, reason: string): Promise<void> {
    // TODO: send a warning message in the group
  }

  async notifyAdmins(text: string): Promise<void> {
    // TODO: DM or notify admins
  }

  capabilities(): AdapterCapabilities {
    return {
      canDelete: true,   // TODO: set to false if unsupported
      canHide:   false,
      canWarn:   true,
      canMute:   false,
      canKick:   false,
    };
  }
}
