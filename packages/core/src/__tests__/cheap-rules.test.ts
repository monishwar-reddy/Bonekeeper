import { describe, it, expect, beforeEach } from 'vitest';
import { checkCheapRules } from '../cheap-rules';
import { Message, GroupConfig } from '../types';

const mockConfig: GroupConfig = {
  groupId: 'test-group',
  description: 'Test group',
  strictness: 'balanced',
  allowlist: {
    users: [],
    domains: ['trusted.com']
  },
  deleteLinksFromNonAdmins: false,
  requireAdminApproval: false,
  dryRun: false,
  enableRepeatOffenderAction: false
};

const createMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  platform: 'test',
  groupId: 'test-group',
  sender: {
    id: 'user-1',
    name: 'Test User',
    role: 'member',
    joinedAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
  },
  text: 'Test message',
  links: [],
  isForwarded: false,
  timestamp: new Date(),
  ...overrides
});

describe('checkCheapRules', () => {
  it('should block URL shorteners', () => {
    const message = createMessage({
      links: ['https://bit.ly/abc123']
    });
    const result = checkCheapRules(message, mockConfig);
    expect(result.isSpam).toBe(true);
    expect(result.reason).toContain('Blocklisted domain');
  });

  it('should block new members posting links', () => {
    const message = createMessage({
      sender: {
        id: 'user-1',
        name: 'New User',
        role: 'member',
        joinedAt: new Date(Date.now() - 5 * 60 * 1000) // 5 min ago
      },
      links: ['https://example.com']
    });
    const result = checkCheapRules(message, mockConfig);
    expect(result.isSpam).toBe(true);
    expect(result.reason).toContain('New member');
  });

  it('should block forwarded chain messages', () => {
    const message = createMessage({
      text: 'Forward this to 10 friends or bad luck!',
      isForwarded: true
    });
    const result = checkCheapRules(message, mockConfig);
    expect(result.isSpam).toBe(true);
    expect(result.reason).toContain('chain message');
  });

  it('should allow trusted domains', () => {
    const message = createMessage({
      links: ['https://trusted.com/page']
    });
    const result = checkCheapRules(message, mockConfig);
    expect(result.isSpam).toBe(false);
  });

  it('should allow normal messages', () => {
    const message = createMessage();
    const result = checkCheapRules(message, mockConfig);
    expect(result.isSpam).toBe(false);
  });

  it('should remove ordinary links from established members', () => {
    const message = createMessage({
      text: 'Here is the resource: https://example.com/article',
      links: ['https://example.com/article']
    });
    const result = checkCheapRules(message, mockConfig);
    expect(result.isSpam).toBe(true);
    expect(result.reason).toContain('Link from non-admin');
  });

  it('should catch bare scam domains emitted without a URL scheme', () => {
    const message = createMessage({
      text: '1000x your investment in 24h. Join moonshot-guaranteed.xyz'
    });
    const result = checkCheapRules(message, mockConfig);
    expect(result.isSpam).toBe(true);
    expect(result.reason).toContain('Suspicious link');
  });

  it('should not flag a short benign greeting', () => {
    const message = createMessage({ text: 'hi' });
    const result = checkCheapRules(message, mockConfig);
    expect(result.isSpam).toBe(false);
  });
});
