
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserIdFromCookie } from '@/lib/auth';

/**
 * Generates a security signature for ImageKit direct client-side uploads.
 * Requires IMAGEKIT_PRIVATE_KEY and NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY.
 */
export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const token = crypto.randomBytes(16).toString('hex');
  const expire = Math.floor(Date.now() / 1000) + 1800; // 30 mins
  
  const signature = crypto
    .createHmac('sha1', privateKey)
    .update(token + expire)
    .digest('hex');

  return NextResponse.json({
    token,
    expire,
    signature,
  });
}
