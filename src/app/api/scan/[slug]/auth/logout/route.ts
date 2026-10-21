import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { endScannerSession, scannerCookieName } from '@/lib/scannerLinkAuth';

// POST /api/scan/[slug]/auth/logout
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = await getDb();
    await endScannerSession(db, slug, req.cookies.get(scannerCookieName(slug))?.value);
    const res = NextResponse.json({ success: true });
    res.cookies.set(scannerCookieName(slug), '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('[scanner_logout]', err);
    return NextResponse.json({ error: 'Could not sign out.' }, { status: 500 });
  }
}
