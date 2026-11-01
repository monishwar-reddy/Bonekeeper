import { NextRequest, NextResponse } from 'next/server';
import { getAuditRecords, getCorrections } from '@/lib/store';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const audit       = await getAuditRecords();
  const corrections = await getCorrections();

  const deleted  = audit.filter(r => r.action === 'deleted').length;
  const held     = audit.filter(r => r.action === 'held').length;
  const restored = audit.filter(r => r.reviewStatus === 'restored').length;
  const fpRate   = deleted + restored > 0
    ? ((restored / (deleted + restored)) * 100).toFixed(1)
    : '0.0';

  return NextResponse.json({ audit, deleted, held, restored, fpRate, correctionsCount: corrections.length });
}
