import { NextResponse } from 'next/server';
import { resetState } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await resetState();
  } catch (error) {
    console.error('[session-reset] reset failed:', error);
    return NextResponse.json({ error: 'Unable to reset demo session' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
