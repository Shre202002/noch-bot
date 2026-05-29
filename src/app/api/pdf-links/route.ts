// src/app/api/pdf-links/route.ts
// Manages shareable public PDF chat links
// POST   → create a share link for a PDF
// GET    → list all share links for the user
// DELETE → remove a share link

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { randomBytes } from 'crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/pdf-links — list all links for the logged-in user
export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const db = await getDb();
    const links = await db
      .collection('pdf_links')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ links }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/pdf-links — create share link
// Body: { fileId, filename, label? }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { fileId, filename, label } = await req.json();
    if (!fileId || !filename) {
      return NextResponse.json({ error: 'fileId and filename are required.' }, { status: 400 });
    }

    const slug = randomBytes(8).toString('hex'); // 16-char unique slug
    const db = await getDb();

    const doc = {
      userId,
      fileId,
      filename,
      label: label || filename,
      slug,
      createdAt: new Date().toISOString(),
    };

    await db.collection('pdf_links').insertOne(doc);

    return NextResponse.json({ success: true, slug, link: `/pdf-chat/${slug}` }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// DELETE /api/pdf-links?slug=xxx — remove a link
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const slug = new URL(req.url).searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'slug is required.' }, { status: 400 });

    const db = await getDb();
    await db.collection('pdf_links').deleteOne({ slug, userId });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}