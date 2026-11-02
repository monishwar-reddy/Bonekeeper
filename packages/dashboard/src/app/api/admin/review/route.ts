import { NextRequest, NextResponse } from 'next/server';
import {
  updateAuditReview,
  updateAuditRecord,
  updateMessageStatus,
  getAuditRecords,
  addCorrection,
  getCorrections,
  updateGroupConfig,
  getGroupConfig,
  decrementUserWarning,
  setUserWarning,
  getUser,
} from '@/lib/store';
import { syncCorrectionsToClassifier } from '@/lib/moderator';
import { requireAdmin } from '@/lib/auth';
import { ModerationCategory, ReviewStatus } from '@/vendor/core/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const body = await req.json() as {
    action: 'restore' | 'confirm' | 'allow_sender' | 'allow_domain' | 'allow_phrase' | 'change_category' | 'undo';
    auditId: string;
    newCategory?: ModerationCategory;
    domain?: string;
    phrase?: string;
    prevState?: {
      prevMessageStatus?: 'ok' | 'deleted' | 'held' | 'restored';
      prevReviewStatus?: ReviewStatus;
      prevWarningCount?: number;
      prevCategory?: ModerationCategory;
    };
  };

  const audit = await getAuditRecords();
  const record = audit.find(r => r.id === body.auditId);
  if (!record) return NextResponse.json({ error: 'not found' }, { status: 404 });

  switch (body.action) {
    case 'restore': {
      await updateMessageStatus(record.messageId, 'restored');
      await updateAuditReview(body.auditId, 'restored', 'admin');
      if (record.senderId) {
        await decrementUserWarning(record.senderId);
      }
      await addCorrection(record.messageText, record.category, 'fine');
      await syncCorrectionsToClassifier();
      break;
    }
    case 'confirm': {
      await updateAuditReview(body.auditId, 'confirmed', 'admin');
      break;
    }
    case 'allow_sender': {
      const config = await getGroupConfig();
      const users = [...config.allowlist.users];
      if (record.senderId && !users.includes(record.senderId)) users.push(record.senderId);
      if (record.senderName && !users.includes(record.senderName)) users.push(record.senderName);
      await updateGroupConfig({
        allowlist: { ...config.allowlist, users },
      });
      await updateMessageStatus(record.messageId, 'restored');
      await updateAuditReview(body.auditId, 'restored', 'admin');
      if (record.senderId) await decrementUserWarning(record.senderId);
      break;
    }
    case 'allow_domain': {
      let domain = body.domain;
      if (!domain) {
        const urlMatch = record.messageText.match(/https?:\/\/([^/\s]+)/i);
        if (urlMatch) domain = urlMatch[1].toLowerCase();
      }
      if (domain) {
        const config = await getGroupConfig();
        if (!config.allowlist.domains.includes(domain)) {
          await updateGroupConfig({
            allowlist: { ...config.allowlist, domains: [...config.allowlist.domains, domain] },
          });
        }
      }
      await updateMessageStatus(record.messageId, 'restored');
      await updateAuditReview(body.auditId, 'restored', 'admin');
      if (record.senderId) await decrementUserWarning(record.senderId);
      break;
    }
    case 'allow_phrase': {
      const phrase = body.phrase || record.messageText.trim();
      if (phrase) {
        const config = await getGroupConfig();
        const phrases = config.allowlist.phrases || [];
        if (!phrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
          await updateGroupConfig({
            allowlist: { ...config.allowlist, phrases: [...phrases, phrase] },
          });
        }
      }
      await updateMessageStatus(record.messageId, 'restored');
      await updateAuditReview(body.auditId, 'restored', 'admin');
      if (record.senderId) await decrementUserWarning(record.senderId);
      break;
    }
    case 'change_category': {
      if (body.newCategory) {
        await addCorrection(record.messageText, record.category, body.newCategory);
        await syncCorrectionsToClassifier();
        await updateAuditRecord(body.auditId, { category: body.newCategory });
        await updateAuditReview(body.auditId, 'confirmed', 'admin');
      }
      break;
    }
    case 'undo': {
      if (body.prevState) {
        if (body.prevState.prevMessageStatus) {
          await updateMessageStatus(record.messageId, body.prevState.prevMessageStatus);
        }
        if (body.prevState.prevReviewStatus) {
          await updateAuditReview(body.auditId, body.prevState.prevReviewStatus, 'admin (undo)');
        }
        if (body.prevState.prevWarningCount !== undefined && record.senderId) {
          await setUserWarning(record.senderId, body.prevState.prevWarningCount);
        }
        if (body.prevState.prevCategory) {
          await updateAuditRecord(body.auditId, { category: body.prevState.prevCategory });
        }
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
