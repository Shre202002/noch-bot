import { NextRequest, NextResponse } from 'next/server';
import type { Db } from 'mongodb';
import { getDb } from './db';
import {
  ensureScannerIndexes,
  findActiveScannerLink,
  scannerCookieName,
  SCANNER_AUTH_MESSAGES,
  verifyScannerSession,
  type ScannerLink,
} from './scannerLinkAuth';
import type { BaseLinkUser } from './linkAuthCore';

export const SCANNER_LINK_UNAVAILABLE = "This scanner link isn't available.";

/** The active link for a slug, or the 404 to return. */
export async function requireScannerLink(slug: string): Promise<{ db: Db; link: ScannerLink } | NextResponse> {
  const db = await getDb();
  await ensureScannerIndexes(db);
  const link = await findActiveScannerLink(db, slug);
  if (!link) return NextResponse.json({ error: SCANNER_LINK_UNAVAILABLE }, { status: 404 });
  return { db, link };
}

/** The signed-in, approved scanner account for a request, or the 401/403 to return. */
export async function requireScannerSession(
  req: NextRequest,
  slug: string
): Promise<{ db: Db; link: ScannerLink; user: BaseLinkUser } | NextResponse> {
  const found = await requireScannerLink(slug);
  if (found instanceof NextResponse) return found;
  const session = await verifyScannerSession(found.db, slug, req.cookies.get(scannerCookieName(slug))?.value);
  if ('error' in session) {
    return NextResponse.json(
      { signedIn: false, code: session.error, error: SCANNER_AUTH_MESSAGES[session.error] },
      { status: session.error === 'none' || session.error === 'replaced' ? 401 : 403 }
    );
  }
  return { ...found, user: session.user };
}
