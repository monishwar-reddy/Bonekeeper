import { Message, GroupConfig } from './types';

export function isProtectedSender(message: Message, config: GroupConfig): boolean {
  // Check if sender has protected role
  const protectedRoles = ['owner', 'admin', 'moderator'];
  if (protectedRoles.includes(message.sender.role)) {
    return true;
  }

  // Check if sender is on allowlist
  if (config.allowlist.users.includes(message.sender.id)) {
    return true;
  }

  return false;
}
