import { Message, GroupConfig } from './types';

const BLOCKLISTED_DOMAINS = [
  'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly',
  'is.gd', 'buff.ly', 'adf.ly', 'bc.vc', 'shorte.st'
];

const MESSAGE_HISTORY = new Map<string, Array<{ text: string; timestamp: Date }>>();
const FLOOD_HISTORY = new Map<string, number[]>();

export interface CheapRuleResult {
  isSpam: boolean;
  reason?: string;
}

export function checkCheapRules(message: Message, config: GroupConfig): CheapRuleResult {
  // Check for blocklisted domains or URL shorteners
  for (const link of message.links) {
    try {
      const domain = new URL(link).hostname.toLowerCase();
      if (BLOCKLISTED_DOMAINS.some(blocked => domain.includes(blocked))) {
        return { isSpam: true, reason: 'Blocklisted domain or URL shortener detected' };
      }
      
      // Check allowlist
      if (!config.allowlist.domains.some(allowed => domain.includes(allowed.toLowerCase()))) {
        // If deleteLinksFromNonAdmins is enabled and user is not admin
        if (config.deleteLinksFromNonAdmins && message.sender.role === 'member') {
          return { isSpam: true, reason: 'Link from non-admin user' };
        }
      }
    } catch {
      // Invalid URL, skip
    }
  }

  // Check for repeated messages (same message 5 times in 10 minutes)
  const userKey = `${message.groupId}:${message.sender.id}`;
  if (!MESSAGE_HISTORY.has(userKey)) {
    MESSAGE_HISTORY.set(userKey, []);
  }
  
  const history = MESSAGE_HISTORY.get(userKey)!;
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  
  // Clean old messages
  const recentMessages = history.filter(h => h.timestamp > tenMinutesAgo);
  MESSAGE_HISTORY.set(userKey, recentMessages);
  
  // Add current message
  recentMessages.push({ text: message.text, timestamp: message.timestamp });
  
  // Count identical messages
  const identicalCount = recentMessages.filter(h => h.text === message.text).length;
  if (identicalCount >= 5) {
    return { isSpam: true, reason: 'Same message repeated 5+ times in 10 minutes' };
  }

  // Check for flood (more than 10 messages in 30 seconds)
  if (!FLOOD_HISTORY.has(userKey)) {
    FLOOD_HISTORY.set(userKey, []);
  }
  
  const floodTimestamps = FLOOD_HISTORY.get(userKey)!;
  const thirtySecondsAgo = Date.now() - 30 * 1000;
  
  // Clean old timestamps
  const recentTimestamps = floodTimestamps.filter(ts => ts > thirtySecondsAgo);
  FLOOD_HISTORY.set(userKey, recentTimestamps);
  
  // Add current timestamp
  recentTimestamps.push(message.timestamp.getTime());
  
  if (recentTimestamps.length > 10) {
    return { isSpam: true, reason: 'Flood detected: 10+ messages in 30 seconds' };
  }

  // Check for new member posting links (joined < 10 min ago)
  const tenMinutesInMs = 10 * 60 * 1000;
  const accountAge = message.timestamp.getTime() - message.sender.joinedAt.getTime();
  if (accountAge < tenMinutesInMs && message.links.length > 0) {
    return { isSpam: true, reason: 'New member (< 10 min) posting links' };
  }

  // Check for forwarded chain-message patterns
  if (message.isForwarded) {
    const chainPatterns = [
      /forward.*to.*\d+/i,
      /send.*this.*to.*\d+/i,
      /share.*or.*bad.*luck/i,
      /copy.*and.*paste/i,
      /repost.*or/i
    ];
    
    if (chainPatterns.some(pattern => pattern.test(message.text))) {
      return { isSpam: true, reason: 'Forwarded chain message pattern detected' };
    }
  }

  return { isSpam: false };
}
