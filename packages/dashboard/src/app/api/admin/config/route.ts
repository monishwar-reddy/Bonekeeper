import { NextRequest, NextResponse } from 'next/server';
import { getGroupConfig, updateGroupConfig } from '@/lib/store';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getGroupConfig());
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  const patch = await req.json();
  await updateGroupConfig(patch);
  return NextResponse.json(await getGroupConfig());
}
