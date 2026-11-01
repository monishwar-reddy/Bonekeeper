import { Message, GroupConfig } from './types';
export function isProtectedSender(message: Message, config: GroupConfig): boolean {
  if (['owner', 'admin', 'moderator'].includes(message.sender.role)) return true;
  if (config.allowlist.users.includes(message.sender.id)) return true;
  return false;
}
