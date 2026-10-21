import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { findAccountById } from '@/lib/storage';
import { NOT_DELETED, PDF_FILES_COLLECTION, PDF_LIMITS, restorePdf } from '@/lib/pdfRetention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/ingest/pdf/restore  Body: { fileId }
// Restores a soft-deleted document (and its shared links) inside the retention window.
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fileId = typeof body.fileId === 'string' ? body.fileId : '';
    if (!fileId) return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });

    const db = await getDb();

    // A restored document counts against the plan again, so it must fit.
    const account = await findAccountById(userId);
    const plan = account?.plan || 'free';
    const limit = PDF_LIMITS[plan] ?? 1;
    const liveCount = await db.collection(PDF_FILES_COLLECTION).countDocuments({ userId, ...NOT_DELETED });
    if (liveCount >= limit) {
      return NextResponse.json(
        {
          error: `Your ${plan} plan allows ${limit} document${limit === 1 ? '' : 's'}. Delete one or upgrade before restoring this one.`,
          limitReached: true,
        },
        { status: 409 }
      );
    }

    const result = await restorePdf(db, userId, fileId);
    if (!result) {
      return NextResponse.json({ error: 'This document can no longer be restored.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, restored: fileId });
  } catch (err) {
    console.error('[pdf-ingest:restore]', err);
    return NextResponse.json({ error: 'Restore failed. Please try again.' }, { status: 500 });
  }
}
