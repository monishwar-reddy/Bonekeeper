import { describe, it, expect } from 'vitest';
import { isProtectedSender } from '../protected-senders';
import { Message, GroupConfig } from '../types';

const mockConfig: GroupConfig = {
  groupId: 'test-group',
  description: 'Test group',
  strictness: 'balanced',
  allowlist: {
    users: ['allowlisted-user'],
    domains: []
  },
  deleteLinksFromNonAdmins: false,
  requireAdminApproval: false,
  dryRun: false,
  enableRepeatOffenderAction: false
};

const createMessage = (role: any, userId: string = 'user-1'): Message => ({
  id: 'msg-1',
  platform: 'test',
  groupId: 'test-group',
  sender: {
    id: userId,
    name: 'Test User',
    role,
    joinedAt: new Date()
  },
  text: 'Test message',
  links: [],
  isForwarded: false,
  timestamp: new Date()
});

describe('isProtectedSender', () => {
  it('should protect admin users', () => {
    const message = createMessage('admin');
    expect(isProtectedSender(message, mockConfig)).toBe(true);
  });

  it('should protect moderator users', () => {
    const message = createMessage('moderator');
    expect(isProtectedSender(message, mockConfig)).toBe(true);
  });

  it('should protect owner users', () => {
    const message = createMessage('owner');
    expect(isProtectedSender(message, mockConfig)).toBe(true);
  });

  it('should protect allowlisted users', () => {
    const message = createMessage('member', 'allowlisted-user');
    expect(isProtectedSender(message, mockConfig)).toBe(true);
  });

  it('should not protect regular members', () => {
    const message = createMessage('member');
    expect(isProtectedSender(message, mockConfig)).toBe(false);
  });
});
