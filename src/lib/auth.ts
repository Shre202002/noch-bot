
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { findAccountById, type Account } from '@/lib/storage';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  // A missing secret in production would let anyone forge a token, admin included.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return 'fallback_dev_secret';
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, getSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, getSecret()) as { userId: string };
  } catch {
    return null;
  }
}

/**
 * Returns the signed-in account id, or null when there is no valid session.
 * Deactivated accounts are treated as signed out so existing tokens stop working immediately.
 */
export async function getUserIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.userId) return null;
  const account = await findAccountById(payload.userId);
  if (!account || account.disabled) return null;
  return payload.userId;
}

export async function getSessionAccount(): Promise<Account | null> {
  const userId = await getUserIdFromCookie();
  if (!userId) return null;
  return (await findAccountById(userId)) ?? null;
}

export type SuperAdminResult =
  | { ok: true; admin: Account }
  | { ok: false; response: NextResponse };

/** Server-side gate for every /api/admin route. Hiding UI is not access control. */
export async function requireSuperAdmin(): Promise<SuperAdminResult> {
  const account = await getSessionAccount();
  if (!account) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (account.role !== 'superadmin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, admin: account };
}
