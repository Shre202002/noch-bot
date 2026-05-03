
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';

export function signToken(userId: string): string {
  return jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUserIdFromCookie(req?: NextRequest): Promise<string | null> {
  let token: string | undefined;
  if (req) {
    token = req.cookies.get('token')?.value;
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get('token')?.value;
  }
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

export function createTokenCookie(userId: string) {
  return {
    name: 'token',
    value: signToken(userId),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };
}
