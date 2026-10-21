import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { endLinkSession, linkCookieName } from '@/lib/linkUserAuth';

// POST /api/pdf-links/[slug]/auth/logout
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const db = await getDb();
    await endLinkSession(db, slug, req.cookies.get(linkCookieName(slug))?.value);
  } catch (err) {
    console.error('[pdf_link_logout]', err);
  }
  // Clear the cookie even if the server-side session could not be ended.
  const res = NextResponse.json({ success: true });
  res.cookies.set(linkCookieName(slug), '', { path: '/', maxAge: 0 });
  return res;
}
