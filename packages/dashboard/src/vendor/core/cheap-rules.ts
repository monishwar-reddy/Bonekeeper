import { Message, GroupConfig } from './types';
const BLOCKLISTED = ['bit.ly','tinyurl.com','goo.gl','t.co','ow.ly','is.gd','buff.ly','adf.ly','bc.vc','shorte.st'];
// Scam TLD patterns in raw text
const SCAM_PATTERNS = [/\b(?:[a-z0-9-]+\.)+(?:xyz|tk|ml|ga|cf|click|top|work|zip)\b/i];
const SCAM_LANGUAGE = /\b(?:airdrop|double your|guaranteed|send\s+(?:eth|btc|crypto)|free crypto|investment|signal group|900%\s*apy)\b/i;
const MSG_HISTORY = new Map<string, Array<{ text: string; timestamp: Date }>>();
const FLOOD_HISTORY = new Map<string, number[]>();
const SUSPICIOUS_DOMAINS = /\.(xyz|tk|ml|ga|cf|click|top|work|zip)(?:[/:?#]|$)/i;
const SCAM_LINK_LANGUAGE = /\b(?:airdrop|double your|guaranteed|send\s+(?:eth|btc|crypto)|free crypto|investment|signal group|900%\s*apy)\b/i;
export interface CheapRuleResult { isSpam: boolean; reason?: string; }
export function checkCheapRules(message: Message, config: GroupConfig): CheapRuleResult {
  // Check links array AND raw text for blocklisted domains
  const allText = message.text.toLowerCase();
  if (BLOCKLISTED.some(b => allText.includes(b))) {
    return { isSpam: true, reason: 'Blocklisted domain or URL shortener detected' };
  }
  // Bot adapters may provide a bare domain without a URL scheme.
  if (SCAM_PATTERNS.some(p => p.test(message.text)) && SCAM_LANGUAGE.test(message.text)) {
    return { isSpam: true, reason: 'Suspicious link and scam language detected' };
  }

  const links = [...message.links];
  const textLinks = message.text.match(/(?:https?:\/\/|www\.)[^\s]+|(?:^|\s)(?:[a-z0-9-]+\.)+(?:com|org|net|io|xyz|tk|ml|ga|cf|click|top|work|zip)\b/gi) || [];
  for (const link of textLinks) if (!links.includes(link.trim())) links.push(link.trim());
  const isNewMember = message.timestamp.getTime() - message.sender.joinedAt.getTime() < 600_000;
  if (message.text.trim().length <= 20 && links.length === 0 && !message.isForwarded) {
    return { isSpam: false };
  }

  for (const link of links) {
    try {
      const domain = new URL(link.startsWith('http') ? link : `https://${link}`).hostname.toLowerCase();
      if (BLOCKLISTED.some(b => domain.includes(b))) return { isSpam: true, reason: 'Blocklisted domain or URL shortener detected' };
      if (!config.allowlist.domains.some(a => domain.includes(a.toLowerCase()))) {
        if (message.sender.role === 'member') return { isSpam: true, reason: isNewMember ? 'New member (< 10 min) posting links' : 'Link from non-admin user' };
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
  if (isNewMember && links.length > 0) return { isSpam: true, reason: 'New member (< 10 min) posting links' };
  if (message.isForwarded) {
    const pats = [/forward.*to.*\d+/i,/send.*this.*to.*\d+/i,/share.*or.*bad.*luck/i,/copy.*and.*paste/i,/repost.*or/i];
    if (pats.some(p => p.test(message.text))) return { isSpam: true, reason: 'Forwarded chain message pattern detected' };
  }
  return { isSpam: false };
}
