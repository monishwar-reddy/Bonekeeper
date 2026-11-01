import { PlatformAdapter, AdapterCapabilities, Message, ModerationAction } from '../core/types';
export type SimulatedEvent =
  | { type: 'delete'; messageId: string }
  | { type: 'warn'; userId: string; warningCount: number; reason: string }
  | { type: 'mute'; userId: string; until: Date }
  | { type: 'adminNotify'; text: string };

export class SimulatedAdapter implements PlatformAdapter {
  private events: SimulatedEvent[] = [];
  private warnCounts = new Map<string, number>();
  getEvents() { return [...this.events]; }
  clearEvents() { this.events = []; }
  async delete(messageId: string) { this.events.push({ type:'delete', messageId }); }
  async hide(messageId: string) { await this.delete(messageId); }
  async warn(userId: string, reason: string) {
    const c = (this.warnCounts.get(userId)||0)+1;
    this.warnCounts.set(userId, c);
    this.events.push({ type:'warn', userId, warningCount:c, reason });
    if (c >= 3) { this.events.push({ type:'mute', userId, until: new Date(Date.now()+30_000) }); this.warnCounts.set(userId,0); }
  }
  async notifyAdmins(text: string) { this.events.push({ type:'adminNotify', text }); }
  capabilities(): AdapterCapabilities { return { canDelete:true, canHide:false, canWarn:true, canMute:true, canKick:false }; }
}

export function describeModerationResult(a: ModerationAction): string {
  switch(a.type) {
    case 'delete': return `Deleted (${a.category}, ${Math.round((a.confidence||0)*100)}%)`;
    case 'quarantine': return `Held (${a.category}, ${Math.round((a.confidence||0)*100)}%)`;
    case 'warn': return 'Warning issued';
    case 'allow': return 'Allowed';
  }
}
