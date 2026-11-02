import { Message, GroupConfig } from './types';
export function isProtectedSender(message: Message, config: GroupConfig): boolean {
  if (['owner', 'admin', 'moderator'].includes(message.sender.role)) return true;
  if (config.allowlist?.users?.includes(message.sender.id) || config.allowlist?.users?.includes(message.sender.name)) return true;
  if (config.allowlist?.phrases?.some(p => p && message.text.toLowerCase().includes(p.toLowerCase()))) return true;
  if (config.allowlist?.domains?.length && message.links?.length) {
    for (const link of message.links) {
      try {
        const domain = new URL(link).hostname.toLowerCase();
        if (config.allowlist.domains.some(d => d && domain.includes(d.toLowerCase()))) return true;
      } catch {}
    }
  }
  return false;
}
