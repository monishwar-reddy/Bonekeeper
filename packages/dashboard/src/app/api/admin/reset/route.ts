import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { resetState } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Module-level reset flag — Next.js reuses the module between requests
let _resetFlag = false;

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  try {
    await resetState();
  } catch (error) {
    console.error('[admin/reset] reset failed:', error);
    return NextResponse.json({ error: 'Unable to reset this chat session' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
