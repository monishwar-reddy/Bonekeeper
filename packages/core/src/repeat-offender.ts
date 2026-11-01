import { Message } from './types';

interface OffenderRecord {
  deletions: Date[];
}

const OFFENDER_HISTORY = new Map<string, OffenderRecord>();

export function trackDeletion(message: Message): void {
  const key = `${message.groupId}:${message.sender.id}`;
  
  if (!OFFENDER_HISTORY.has(key)) {
    OFFENDER_HISTORY.set(key, { deletions: [] });
  }

  const record = OFFENDER_HISTORY.get(key)!;
  record.deletions.push(message.timestamp);

  // Clean old deletions (older than 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  record.deletions = record.deletions.filter(d => d > twentyFourHoursAgo);
}

export function shouldWarnRepeatOffender(message: Message): boolean {
  const key = `${message.groupId}:${message.sender.id}`;
  const record = OFFENDER_HISTORY.get(key);

  if (!record) {
    return false;
  }

  // 3 deletions in 24 hours triggers a warning
  return record.deletions.length >= 3;
}

export function getDeletionCount(message: Message): number {
  const key = `${message.groupId}:${message.sender.id}`;
  const record = OFFENDER_HISTORY.get(key);
  return record ? record.deletions.length : 0;
}
