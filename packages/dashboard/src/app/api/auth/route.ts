import { NextRequest, NextResponse } from 'next/server';
import { sign } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

// Rate-limit PIN attempts per IP
const attempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) { rec = { count: 0, resetAt: now + 60_000 }; attempts.set(ip, rec); }
  rec.count++;
  return rec.count <= 10;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const { pin, role } = await req.json() as { pin?: string; role: string };
  if (role === 'admin' && pin !== ADMIN_PIN) {
    return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 });
  }

  const cookieRole = role === 'admin' ? 'admin' : 'member';
  const signed = sign(cookieRole);
  const sessionId = req.cookies.get('bk_session')?.value || uuidv4();

  const res = NextResponse.json({ ok: true, role: cookieRole });
  // httpOnly signed cookie for server-side auth checks
  res.cookies.set('bk_role', signed, {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  // readable display cookie for nav
  res.cookies.set('bk_role_display', cookieRole, {
    httpOnly: false,
    maxAge: 60 * 60 * 24,
    path: '/',
    sameSite: 'lax',
  });
  res.cookies.set('bk_session', sessionId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('bk_role');
  res.cookies.delete('bk_role_display');
  res.cookies.delete('bk_session');
  return res;
}
