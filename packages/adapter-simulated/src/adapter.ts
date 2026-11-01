import {
  PlatformAdapter,
  AdapterCapabilities,
  Message,
  ModerationAction,
} from '@bonekeeper/core';

export type SimulatedEvent =
  | { type: 'delete'; messageId: string }
  | { type: 'warn'; userId: string; warningCount: number; reason: string }
  | { type: 'mute'; userId: string; until: Date }
  | { type: 'adminNotify'; text: string };

export class SimulatedAdapter implements PlatformAdapter {
  private events: SimulatedEvent[] = [];
  private warningCounts: Map<string, number> = new Map();

  getEvents(): SimulatedEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  async delete(messageId: string): Promise<void> {
    this.events.push({ type: 'delete', messageId });
  }

  async hide(messageId: string): Promise<void> {
    await this.delete(messageId); // no hide in simulated env
  }

  async warn(userId: string, reason: string): Promise<void> {
    const count = (this.warningCounts.get(userId) || 0) + 1;
    this.warningCounts.set(userId, count);
    this.events.push({ type: 'warn', userId, warningCount: count, reason });

    // 3 warnings → mute for 30 seconds, then reset
    if (count >= 3) {
      const until = new Date(Date.now() + 30_000);
      this.events.push({ type: 'mute', userId, until });
      this.warningCounts.set(userId, 0);
    }
  }

  async notifyAdmins(text: string): Promise<void> {
    this.events.push({ type: 'adminNotify', text });
  }

  getWarningCount(userId: string): number {
    return this.warningCounts.get(userId) || 0;
  }

  capabilities(): AdapterCapabilities {
    return {
      canDelete: true,
      canHide: false,
      canWarn: true,
      canMute: true,
      canKick: false,
    };
  }
}

// Helper: map a ModerationAction to a human-readable result
export function describeModerationResult(action: ModerationAction): string {
  switch (action.type) {
    case 'delete': return `Deleted (${action.category}, ${Math.round((action.confidence || 0) * 100)}%)`;
    case 'quarantine': return `Held for review (${action.category}, ${Math.round((action.confidence || 0) * 100)}%)`;
    case 'warn': return `Warning issued`;
    case 'allow': return `Allowed`;
  }
}
