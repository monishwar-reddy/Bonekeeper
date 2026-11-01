import { Message } from './types';
const HISTORY = new Map<string, Date[]>();
export function trackDeletion(msg: Message): void {
  const k = `${msg.groupId}:${msg.sender.id}`;
  const cutoff = new Date(Date.now() - 86_400_000);
  const prev = (HISTORY.get(k) || []).filter(d => d > cutoff);
  prev.push(msg.timestamp);
  HISTORY.set(k, prev);
}
export function shouldWarnRepeatOffender(msg: Message): boolean {
  const k = `${msg.groupId}:${msg.sender.id}`;
  return (HISTORY.get(k) || []).length >= 3;
}
