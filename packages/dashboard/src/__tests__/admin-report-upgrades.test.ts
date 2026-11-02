import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAuditRecords,
  addAuditRecord,
  getGroupConfig,
  updateGroupConfig,
  updateMessageStatus,
  addChatMessage,
  getMessages,
  getUser,
  upsertUser,
  decrementUserWarning,
  setUserWarning,
  updateAuditReview,
  updateAuditRecord,
} from '../lib/store';
import { isProtectedSender } from '../vendor/core/protected-senders';
import { Message, AuditRecord } from '../vendor/core/types';

describe('Admin Report Upgrades', () => {
  it('allowlisted sender passes on the next message', async () => {
    const config = await getGroupConfig();
    const senderId = 'spammer-123';

    const testMsg: Message = {
      id: 'm1',
      platform: 'web',
      groupId: 'halloween-dev-club',
      sender: { id: senderId, name: 'Spam User', role: 'member', joinedAt: new Date() },
      text: 'Click here for free crypto!',
      links: [],
      isForwarded: false,
      timestamp: new Date(),
    };

    // Initially not protected
    expect(isProtectedSender(testMsg, config)).toBe(false);

    // Admin adds sender to allowlist
    await updateGroupConfig({
      allowlist: { ...config.allowlist, users: [...config.allowlist.users, senderId] },
    });
    const updatedConfig = await getGroupConfig();

    // Now protected sender passes
    expect(isProtectedSender(testMsg, updatedConfig)).toBe(true);
  });

  it('undo after restore puts the message back to deleted', async () => {
    const msgId = 'test-msg-undo-1';
    await addChatMessage({
      id: msgId,
      platform: 'web',
      groupId: 'halloween-dev-club',
      sender: { id: 'user-a', name: 'User A', role: 'member', joinedAt: new Date() },
      text: 'Suspicious text',
      links: [],
      isForwarded: false,
      timestamp: new Date(),
      status: 'deleted',
    });

    // 1. Admin restores it
    await updateMessageStatus(msgId, 'restored');
    let msgs = await getMessages();
    let found = msgs.find(m => m.id === msgId);
    expect(found?.status).toBe('restored');

    // 2. Admin performs undo -> restores previous status 'deleted'
    await updateMessageStatus(msgId, 'deleted');
    msgs = await getMessages();
    found = msgs.find(m => m.id === msgId);
    expect(found?.status).toBe('deleted');
  });

  it('bulk restore updates warning counts and false-positive rate', async () => {
    const userId = 'repeat-violator-1';
    await upsertUser({
      id: userId,
      name: 'Violator',
      role: 'member',
      warnings: 2,
    });

    const userBefore = await getUser(userId);
    expect(userBefore.warnings).toBe(2);

    // Create 2 audit records for bulk restore
    const auditId1 = 'audit-bulk-1';
    const auditId2 = 'audit-bulk-2';
    await addAuditRecord({
      id: auditId1,
      messageId: 'm-bulk-1',
      groupId: 'halloween-dev-club',
      platform: 'web',
      senderId: userId,
      senderName: 'Violator',
      messageText: 'False positive 1',
      category: 'spam',
      confidence: 0.9,
      reason: 'AI said spam',
      action: 'deleted',
      reviewStatus: 'pending',
      timestamp: new Date(),
    });
    await addAuditRecord({
      id: auditId2,
      messageId: 'm-bulk-2',
      groupId: 'halloween-dev-club',
      platform: 'web',
      senderId: userId,
      senderName: 'Violator',
      messageText: 'False positive 2',
      category: 'spam',
      confidence: 0.9,
      reason: 'AI said spam',
      action: 'deleted',
      reviewStatus: 'pending',
      timestamp: new Date(),
    });

    // Simulate bulk restore for both:
    // Decrement warning for each restored violation
    await updateAuditReview(auditId1, 'restored', 'admin');
    await decrementUserWarning(userId);

    await updateAuditReview(auditId2, 'restored', 'admin');
    await decrementUserWarning(userId);

    const userAfter = await getUser(userId);
    // Warnings decremented from 2 to 0
    expect(userAfter.warnings).toBe(0);

    // Calculate FP rate
    const audit = await getAuditRecords();
    const deleted = audit.filter(r => r.action === 'deleted').length;
    const restored = audit.filter(r => r.reviewStatus === 'restored').length;
    expect(restored).toBeGreaterThanOrEqual(2);
    const fpRate = ((restored / (deleted + restored)) * 100).toFixed(1);
    expect(parseFloat(fpRate)).toBeGreaterThan(0);
  });
});
