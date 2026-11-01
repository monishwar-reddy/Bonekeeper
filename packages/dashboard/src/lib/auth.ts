import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

export function sign(value: string): string {
  return value + '.' + createHmac('sha256', SESSION_SECRET).update(value).digest('hex').slice(0, 16);
}

export function verify(signed: string): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf('.');
  if (dot === -1) return null;
  const value = signed.slice(0, dot);
  if (sign(value) !== signed) return null;
  return value;
}

export function requireAdmin(req: NextRequest): boolean {
  const signed = req.cookies.get('bk_role')?.value;
  if (!signed) return false;
  return verify(signed) === 'admin';
}

export function getRole(req: NextRequest): string | null {
  const signed = req.cookies.get('bk_role')?.value;
  if (!signed) return null;
  return verify(signed);
}
