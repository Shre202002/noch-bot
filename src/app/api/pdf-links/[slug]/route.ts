// src/app/api/pdf-links/[slug]/route.ts
// Public endpoint — resolves a share slug → { fileId, userId, label }
// No auth required (it's the public chat lookup)

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const db = await getDb();
    const link = await db.collection('pdf_links').findOne({ slug });

    if (!link) {
      return NextResponse.json({ error: 'Chat link not found.' }, { status: 404 });
    }

    return NextResponse.json({
      fileId: link.fileId,
      userId: link.userId,
      label: link.label,
      filename: link.filename,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}