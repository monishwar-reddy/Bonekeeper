import { Message, GroupConfig } from './types';
const BLOCKLISTED = ['bit.ly','tinyurl.com','goo.gl','t.co','ow.ly','is.gd','buff.ly','adf.ly','bc.vc','shorte.st'];
const MSG_HISTORY = new Map<string, Array<{ text: string; timestamp: Date }>>();
const FLOOD_HISTORY = new Map<string, number[]>();
export interface CheapRuleResult { isSpam: boolean; reason?: string; }
export function checkCheapRules(message: Message, config: GroupConfig): CheapRuleResult {
  for (const link of message.links) {
    try {
      const domain = new URL(link).hostname.toLowerCase();
      if (BLOCKLISTED.some(b => domain.includes(b))) return { isSpam: true, reason: 'Blocklisted domain or URL shortener detected' };
      if (!config.allowlist.domains.some(a => domain.includes(a.toLowerCase()))) {
        if (config.deleteLinksFromNonAdmins && message.sender.role === 'member') return { isSpam: true, reason: 'Link from non-admin user' };
      }
    } catch { /* skip */ }
  }
  const key = `${message.groupId}:${message.sender.id}`;
  const history = MSG_HISTORY.get(key) || [];
  const tenMinsAgo = new Date(Date.now() - 600_000);
  const recent = history.filter(h => h.timestamp > tenMinsAgo);
  recent.push({ text: message.text, timestamp: message.timestamp });
  MSG_HISTORY.set(key, recent);
  if (recent.filter(h => h.text === message.text).length >= 5) return { isSpam: true, reason: 'Same message repeated 5+ times in 10 minutes' };
  const flood = (FLOOD_HISTORY.get(key) || []).filter(ts => ts > Date.now() - 30_000);
  flood.push(message.timestamp.getTime());
  FLOOD_HISTORY.set(key, flood);
  if (flood.length > 10) return { isSpam: true, reason: 'Flood detected: 10+ messages in 30 seconds' };
  if (message.timestamp.getTime() - message.sender.joinedAt.getTime() < 600_000 && message.links.length > 0) return { isSpam: true, reason: 'New member (< 10 min) posting links' };
  if (message.isForwarded) {
    const pats = [/forward.*to.*\d+/i,/send.*this.*to.*\d+/i,/share.*or.*bad.*luck/i,/copy.*and.*paste/i,/repost.*or/i];
    if (pats.some(p => p.test(message.text))) return { isSpam: true, reason: 'Forwarded chain message pattern detected' };
  }
  return { isSpam: false };
}
