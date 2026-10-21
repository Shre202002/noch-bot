// src/app/api/pdf-links/[slug]/route.ts
// Public endpoint: resolves a share slug to { fileId, userId, label }.
// Sign-in protected links reveal only { label, requireLogin } until the visitor holds a valid link session.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { NOT_DELETED } from '@/lib/pdfRetention';
import { linkCookieName, verifyLinkSession } from '@/lib/linkUserAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = await getDb();
    // Links of a soft-deleted document expire immediately.
    const link = await db.collection('pdf_links').findOne({ slug, ...NOT_DELETED });

    if (!link) {
      return NextResponse.json({ error: 'Chat link not found.' }, { status: 404 });
    }

    if (link.requireLogin) {
      const session = await verifyLinkSession(db, slug, req.cookies.get(linkCookieName(slug))?.value);
      if ('error' in session) {
        return NextResponse.json({ label: link.label, requireLogin: true, signedIn: false });
      }
      return NextResponse.json({
        fileId: link.fileId,
        userId: link.userId,
        label: link.label,
        filename: link.filename,
        requireLogin: true,
        signedIn: true,
        loginId: session.user.loginId,
      });
    }

    return NextResponse.json({
      fileId: link.fileId,
      userId: link.userId,
      label: link.label,
      filename: link.filename,
      requireLogin: false,
    });
  } catch (err: any) {
    console.error('[pdf_links_get] error:', err);
    return NextResponse.json({ error: 'Could not load this chat link.' }, { status: 500 });
  }
}
