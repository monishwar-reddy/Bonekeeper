import { NextRequest, NextResponse } from 'next/server';
import {
  updateAuditReview,
  updateMessageStatus,
  getAuditRecords,
  addCorrection,
  getCorrections,
  updateGroupConfig,
  getGroupConfig,
} from '@/lib/store';
import { syncCorrectionsToClassifier } from '@/lib/moderator';
import { requireAdmin } from '@/lib/auth';
import { ModerationCategory } from '@/vendor/core/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const body = await req.json() as {
    action: 'restore' | 'confirm' | 'allow_sender' | 'allow_domain' | 'change_category';
    auditId: string;
    newCategory?: ModerationCategory;
    domain?: string;
  };

  const audit = await getAuditRecords();
  const record = audit.find(r => r.id === body.auditId);
  if (!record) return NextResponse.json({ error: 'not found' }, { status: 404 });

  switch (body.action) {
    case 'restore': {
      await updateMessageStatus(record.messageId, 'restored');
      await updateAuditReview(body.auditId, 'restored', 'admin');
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
      if (record.senderId && !config.allowlist.users.includes(record.senderId)) {
        await updateGroupConfig({
          allowlist: { ...config.allowlist, users: [...config.allowlist.users, record.senderId] },
        });
      }
      await updateAuditReview(body.auditId, 'restored', 'admin');
      break;
    }
    case 'allow_domain': {
      if (body.domain) {
        const config = await getGroupConfig();
        if (!config.allowlist.domains.includes(body.domain)) {
          await updateGroupConfig({
            allowlist: { ...config.allowlist, domains: [...config.allowlist.domains, body.domain] },
          });
        }
      }
      await updateAuditReview(body.auditId, 'restored', 'admin');
      break;
    }
    case 'change_category': {
      if (body.newCategory) {
        await addCorrection(record.messageText, record.category, body.newCategory);
        await syncCorrectionsToClassifier();
        record.category = body.newCategory;
        await updateAuditReview(body.auditId, 'confirmed', 'admin');
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
