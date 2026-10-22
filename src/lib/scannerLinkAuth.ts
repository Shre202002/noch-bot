import { randomBytes } from 'crypto';
import { ObjectId, type Db } from 'mongodb';
import { createLinkAuth } from './linkAuthCore';
import { LINK_AUTH_MESSAGES, linkCookieOptions } from './linkUserAuth';

/**
 * Shareable ticket-scanner links. The organizer shares one link per event; door staff register a Login ID and password
 * on it, the organizer approves them, and an approved account can scan that event's tickets only. Accounts follow the
 * PDF share-link model (linkAuthCore.ts) with one difference: staff are never locked out for signing in repeatedly, they
 * just stay on one device at a time.
 */

export const SCANNER_LINKS_COLLECTION = 'scanner_links';
export const SCANNER_USERS_COLLECTION = 'scanner_users';

export interface ScannerLink {
  _id: ObjectId;
  slug: string;
  org_id: string;
  event_id: ObjectId;
  active: boolean;
  created_at: Date;
}

const core = createLinkAuth({ usersCollection: SCANNER_USERS_COLLECTION, tokenKind: 'scan', blockOnAttempts: false });

export const scannerCookieName = (slug: string) => `nbs_${slug}`;
export const scannerCookieOptions = linkCookieOptions;

/** Visitor-facing text for each outcome on the scanner sign-in screen. */
export const SCANNER_AUTH_MESSAGES = {
  ...LINK_AUTH_MESSAGES,
  pending: "Your account is waiting for the organizer's approval.",
  rejected: 'The organizer declined access for this account.',
  blocked: 'This account was blocked by the organizer.',
  none: 'Sign in to scan tickets.',
  invalid_name: 'Enter your name (2 to 60 characters).',
  taken: 'That Login ID is already taken for this event.',
} as const;

const links = (db: Db) => db.collection<ScannerLink>(SCANNER_LINKS_COLLECTION);

let indexesReady: Promise<void> | null = null;
/** Indexes for the scanner link, its accounts and the live scan feed. Safe to call on every request. */
export function ensureScannerIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = Promise.all([
      links(db).createIndex({ slug: 1 }, { unique: true }),
      links(db).createIndex({ event_id: 1 }, { unique: true }),
      db.collection('tickets').createIndex({ event_id: 1, scanned_at: 1 }),
      core.ensureIndexes(db),
    ])
      .then(() => undefined)
      .catch((err) => {
        indexesReady = null;
        throw err;
      });
  }
  return indexesReady;
}

const newSlug = () => randomBytes(9).toString('base64url');

/** The live (not switched off) scanner link for a slug, or null. */
export function findActiveScannerLink(db: Db, slug: string): Promise<ScannerLink | null> {
  return typeof slug === 'string' && slug ? links(db).findOne({ slug, active: true }) : Promise.resolve(null);
}

/** The event's link, active or not, for its owner. */
export function getScannerLinkForEvent(db: Db, orgId: string, eventId: ObjectId): Promise<ScannerLink | null> {
  return links(db).findOne({ org_id: orgId, event_id: eventId });
}

/** One link per event: creating again returns the existing one. */
export async function createScannerLink(db: Db, orgId: string, eventId: ObjectId): Promise<ScannerLink> {
  await links(db).updateOne(
    { event_id: eventId, org_id: orgId },
    { $setOnInsert: { slug: newSlug(), org_id: orgId, event_id: eventId, active: true, created_at: new Date() } },
    { upsert: true }
  );
  return (await getScannerLinkForEvent(db, orgId, eventId))!;
}

export async function setScannerLinkActive(db: Db, orgId: string, eventId: ObjectId, active: boolean): Promise<boolean> {
  const result = await links(db).updateOne({ org_id: orgId, event_id: eventId }, { $set: { active } });
  return result.matchedCount === 1;
}

/**
 * A new address for the same event, for when a link has leaked. Accounts move to the new address but everyone is signed
 * out (their session tokens name the old address), so they must sign in again; anyone holding only the old link is shut out.
 */
export async function rotateScannerLink(db: Db, orgId: string, eventId: ObjectId): Promise<ScannerLink | null> {
  const current = await getScannerLinkForEvent(db, orgId, eventId);
  if (!current) return null;
  const slug = newSlug();
  await links(db).updateOne({ _id: current._id }, { $set: { slug } });
  await db
    .collection(SCANNER_USERS_COLLECTION)
    .updateMany({ slug: current.slug, userId: orgId }, { $set: { slug }, $unset: { currentSessionId: '', sessionIssuedAt: '' } });
  return { ...current, slug };
}

/** A person's name as typed, tidied: single spaces, 2 to 60 characters; otherwise null. */
export function cleanScannerName(name: unknown): string | null {
  const tidy = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  return tidy.length >= 2 && tidy.length <= 60 ? tidy : null;
}

export async function registerScanner(db: Db, link: ScannerLink, loginId: unknown, password: unknown, name: unknown) {
  const cleaned = cleanScannerName(name);
  if (!cleaned) return { error: 'invalid_name' as const };
  return core.register(
    db,
    { slug: link.slug, userId: link.org_id, extra: { event_id: link.event_id } },
    loginId,
    password,
    new Date(),
    { name: cleaned }
  );
}

export const loginScanner = core.login;
export const signScannerToken = core.signToken;
export const verifyScannerSession = core.verifySession;
export const endScannerSession = core.endSession;
export const ownerScannerAction = core.ownerAction;
export const listScanners = core.list;
