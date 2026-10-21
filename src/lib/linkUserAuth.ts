import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId, type Db } from 'mongodb';
import { NOT_DELETED, PDF_LINK_USERS_COLLECTION, PDF_LINKS_COLLECTION } from './pdfRetention';

/**
 * Accounts for sign-in protected PDF RAG share links.
 *
 * Link users are not NochBot organizer accounts: each one belongs to exactly one share link (`slug`), signs up with a
 * Login ID and password on that link's page, and can chat only after the link's owner approves them. An account is
 * signed in on one device at a time (`currentSessionId` is replaced on every successful sign-in, which invalidates the
 * previous device), sessions last LINK_SESSION_TTL_SECONDS with no inactivity timeout, and an approved account that
 * makes more than MAX_LOGIN_ATTEMPTS sign-in attempts inside LOGIN_ATTEMPT_WINDOW_MS is blocked until the owner
 * unblocks it.
 *
 * Records carry the owner's id as `userId` (and the document's `fileId`) so that the document soft delete in
 * pdfRetention.ts covers them.
 */

export const LOGIN_ATTEMPT_WINDOW_MS = 48 * 60 * 60 * 1000;
export const MAX_LOGIN_ATTEMPTS = 2;
export const LINK_SESSION_TTL_SECONDS = 90 * 24 * 60 * 60;

const LOGIN_ID_PATTERN = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
const SECRET = process.env.JWT_SECRET || 'fallback_dev_secret';
// Compared against when the Login ID does not exist, so a missing account costs the same time as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('nochbot-link-user-placeholder', 10);

export type LinkUserStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

export interface LinkUser {
  _id: ObjectId;
  userId: string;          // owner of the link
  fileId: string;
  slug: string;
  loginId: string;
  passwordHash: string;
  status: LinkUserStatus;
  loginAttempts: Date[];   // attempts inside the current window only
  currentSessionId?: string;
  sessionIssuedAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  approvedAt?: Date;
  blockedAt?: Date;
}

/** The fields of a `pdf_links` record this module needs. */
export interface ProtectedLink {
  slug: string;
  userId: string;
  fileId: string;
}

export type LinkSessionError = 'none' | 'replaced' | 'blocked' | 'pending' | 'rejected';
export type OwnerAction = 'approve' | 'reject' | 'block' | 'unblock' | 'signout' | 'remove';

export const linkCookieName = (slug: string) => `nbl_${slug}`;

export const linkCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: LINK_SESSION_TTL_SECONDS,
};

/** Visitor-facing text for each outcome, shared by the API and the sign-in screen. */
export const LINK_AUTH_MESSAGES = {
  invalid: 'Login ID or password is incorrect.',
  pending: "Your account is waiting for the link owner's approval.",
  rejected: 'The owner of this link declined access for this account.',
  blocked: 'This account is blocked after repeated sign-ins. Ask the owner of this link to unblock it.',
  replaced: 'You were signed out because this account signed in on another device.',
  none: 'Sign in to use this document chat.',
  invalid_login_id: 'Login ID must be 3–32 characters: letters, numbers, dots, dashes or underscores.',
  weak_password: 'Password must be at least 8 characters.',
  taken: 'That Login ID is already taken on this link.',
} as const;

export function normalizeLoginId(loginId: unknown): string {
  return typeof loginId === 'string' ? loginId.trim().toLowerCase() : '';
}

const users = (db: Db) => db.collection<LinkUser>(PDF_LINK_USERS_COLLECTION);

/** A live share link that requires sign-in, or null (missing, deleted, or public). */
export async function findProtectedLink(db: Db, slug: string): Promise<ProtectedLink | null> {
  const link = await db
    .collection(PDF_LINKS_COLLECTION)
    .findOne({ slug, requireLogin: true, ...NOT_DELETED });
  return link ? { slug: link.slug, userId: link.userId, fileId: link.fileId } : null;
}

let indexesReady: Promise<void> | null = null;

export function ensureLinkUserIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = Promise.all([
      users(db).createIndex({ slug: 1, loginId: 1 }, { unique: true }),
      users(db).createIndex({ userId: 1, slug: 1, status: 1 }),
    ])
      .then(() => undefined)
      .catch((err) => {
        indexesReady = null;
        throw err;
      });
  }
  return indexesReady;
}

export async function registerLinkUser(
  db: Db,
  link: ProtectedLink,
  rawLoginId: unknown,
  password: unknown,
  now: Date = new Date()
): Promise<{ ok: true } | { error: 'invalid_login_id' | 'weak_password' | 'taken' }> {
  const loginId = normalizeLoginId(rawLoginId);
  if (!LOGIN_ID_PATTERN.test(loginId)) return { error: 'invalid_login_id' };
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return { error: 'weak_password' };

  try {
    await users(db).insertOne({
      _id: new ObjectId(),
      userId: link.userId,
      fileId: link.fileId,
      slug: link.slug,
      loginId,
      passwordHash: await bcrypt.hash(password, 10),
      status: 'pending',
      loginAttempts: [],
      createdAt: now,
    });
    return { ok: true };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { error: 'taken' };
    throw err;
  }
}

/**
 * Signs a link user in. Attempts on approved accounts are counted (right or wrong password); the attempt that takes
 * the in-window count past MAX_LOGIN_ATTEMPTS blocks the account and is refused. Pending accounts are not counted, so
 * a user checking whether they have been approved cannot block themselves.
 */
export async function attemptLinkLogin(
  db: Db,
  slug: string,
  rawLoginId: unknown,
  password: unknown,
  now: Date = new Date()
): Promise<
  | { ok: true; sessionId: string; user: LinkUser }
  | { error: 'invalid' | 'pending' | 'rejected' | 'blocked' }
> {
  const loginId = normalizeLoginId(rawLoginId);
  const pass = typeof password === 'string' ? password : '';
  const user = loginId ? await users(db).findOne({ slug, loginId }) : null;

  if (!user) {
    await bcrypt.compare(pass, DUMMY_HASH);
    return { error: 'invalid' };
  }
  if (user.status === 'blocked') return { error: 'blocked' };
  if (user.status === 'rejected') return { error: 'rejected' };
  if (user.status === 'pending') {
    return (await bcrypt.compare(pass, user.passwordHash)) ? { error: 'pending' } : { error: 'invalid' };
  }

  // Record this attempt and drop the ones that have left the window, atomically.
  const windowStart = new Date(now.getTime() - LOGIN_ATTEMPT_WINDOW_MS);
  const counted = await users(db).findOneAndUpdate(
    { _id: user._id, status: 'approved' },
    [
      {
        $set: {
          loginAttempts: {
            $concatArrays: [
              {
                $filter: {
                  input: { $ifNull: ['$loginAttempts', []] },
                  cond: { $gt: ['$$this', windowStart] },
                },
              },
              [now],
            ],
          },
        },
      },
    ],
    { returnDocument: 'after' }
  );
  if (!counted) return { error: 'blocked' }; // blocked by a concurrent attempt or the owner

  if (counted.loginAttempts.length > MAX_LOGIN_ATTEMPTS) {
    await users(db).updateOne(
      { _id: user._id },
      { $set: { status: 'blocked', blockedAt: now }, $unset: { currentSessionId: '', sessionIssuedAt: '' } }
    );
    return { error: 'blocked' };
  }

  if (!(await bcrypt.compare(pass, user.passwordHash))) return { error: 'invalid' };

  // A new session id signs out whichever device held the previous one.
  const sessionId = randomBytes(16).toString('hex');
  await users(db).updateOne(
    { _id: user._id },
    { $set: { currentSessionId: sessionId, sessionIssuedAt: now, lastLoginAt: now } }
  );
  return { ok: true, sessionId, user: { ...counted, currentSessionId: sessionId } };
}

export function signLinkToken(user: Pick<LinkUser, '_id' | 'slug'>, sessionId: string): string {
  return jwt.sign({ kind: 'link', luid: user._id.toHexString(), sid: sessionId, slug: user.slug }, SECRET, {
    expiresIn: LINK_SESSION_TTL_SECONDS,
  });
}

export function readLinkToken(token: string | undefined): { luid: string; sid: string; slug: string } | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET) as { kind?: string; luid?: string; sid?: string; slug?: string };
    if (payload.kind !== 'link' || !payload.luid || !payload.sid || !payload.slug) return null;
    return { luid: payload.luid, sid: payload.sid, slug: payload.slug };
  } catch {
    return null;
  }
}

/** Checks a link session token for `slug`. Only the account's current session on an approved account is valid. */
export async function verifyLinkSession(
  db: Db,
  slug: string,
  token: string | undefined
): Promise<{ ok: true; user: LinkUser } | { error: LinkSessionError }> {
  const payload = readLinkToken(token);
  if (!payload || payload.slug !== slug || !ObjectId.isValid(payload.luid)) return { error: 'none' };

  const user = await users(db).findOne({ _id: new ObjectId(payload.luid), slug });
  if (!user) return { error: 'none' };
  if (user.status === 'blocked') return { error: 'blocked' };
  if (user.status === 'pending') return { error: 'pending' };
  if (user.status === 'rejected') return { error: 'rejected' };
  if (!user.currentSessionId) return { error: 'none' };
  if (user.currentSessionId !== payload.sid) return { error: 'replaced' };
  return { ok: true, user };
}

/** Signs the account out of its current device (used by the user's own sign-out). */
export async function endLinkSession(db: Db, slug: string, token: string | undefined): Promise<void> {
  const payload = readLinkToken(token);
  if (!payload || payload.slug !== slug || !ObjectId.isValid(payload.luid)) return;
  await users(db).updateOne(
    { _id: new ObjectId(payload.luid), slug, currentSessionId: payload.sid },
    { $unset: { currentSessionId: '', sessionIssuedAt: '' } }
  );
}

/** Owner-side management, always scoped to the owner's own link. Returns false when the user is not on their link. */
export async function ownerLinkUserAction(
  db: Db,
  ownerId: string,
  slug: string,
  linkUserId: string,
  action: OwnerAction,
  now: Date = new Date()
): Promise<boolean> {
  if (!ObjectId.isValid(linkUserId)) return false;
  const filter = { _id: new ObjectId(linkUserId), userId: ownerId, slug };
  const signOut = { currentSessionId: '', sessionIssuedAt: '' } as const;

  if (action === 'remove') return (await users(db).deleteOne(filter)).deletedCount === 1;

  const updates: Record<Exclude<OwnerAction, 'remove'>, { from: LinkUserStatus[]; update: Record<string, unknown> }> = {
    approve: { from: ['pending', 'rejected'], update: { $set: { status: 'approved', approvedAt: now, loginAttempts: [] } } },
    reject: { from: ['pending'], update: { $set: { status: 'rejected' } } },
    block: { from: ['approved'], update: { $set: { status: 'blocked', blockedAt: now }, $unset: signOut } },
    unblock: { from: ['blocked'], update: { $set: { status: 'approved', loginAttempts: [] }, $unset: { blockedAt: '' } } },
    signout: { from: ['approved'], update: { $unset: signOut } },
  };
  const { from, update } = updates[action];
  const result = await users(db).updateOne({ ...filter, status: { $in: from } }, update);
  return result.matchedCount === 1;
}

/** Link users for the owner's dashboard, without secrets. */
export async function listLinkUsers(db: Db, ownerId: string, slug: string) {
  const docs = await users(db)
    .find({ userId: ownerId, slug }, { projection: { passwordHash: 0, currentSessionId: 0, loginAttempts: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((u) => ({
    id: u._id.toHexString(),
    loginId: u.loginId,
    status: u.status,
    createdAt: u.createdAt,
    approvedAt: u.approvedAt ?? null,
    blockedAt: u.blockedAt ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    signedIn: Boolean(u.sessionIssuedAt),
  }));
}
