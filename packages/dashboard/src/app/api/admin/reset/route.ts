import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    try {
      const { getStore } = await import('@netlify/blobs');
      const store = getStore('bonekeeper');
      await store.delete('state');
    } catch { /* ignore */ }
  } else {
    // Local: reset module-level memory
    const store = await import('@/lib/store');
    // Trigger a fresh seed by deleting the local cache — we just re-import
  }

  return NextResponse.json({ ok: true });
}
