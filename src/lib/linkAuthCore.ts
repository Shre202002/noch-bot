import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId, type Db } from 'mongodb';

/**
 * Sign-in accounts that belong to one share link, approved by the link's owner. Used by the PDF chat share links
 * (linkUserAuth.ts) and the ticket scanner links (scannerLinkAuth.ts); each passes its own collection, cookie name and
 * rules. An account is signed in on one device at a time (`currentSessionId` is replaced on every sign-in, which
 * invalidates the previous device) and sessions last SESSION_TTL_SECONDS with no inactivity timeout.
 */

export const LINK_SESSION_TTL_SECONDS = 90 * 24 * 60 * 60;
export const LOGIN_ATTEMPT_WINDOW_MS = 48 * 60 * 60 * 1000;
export const MAX_LOGIN_ATTEMPTS = 2;

const LOGIN_ID_PATTERN = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
const SECRET = process.env.JWT_SECRET || 'fallback_dev_secret';
// Compared against when the Login ID does not exist, so a missing account costs the same time as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('nochbot-link-user-placeholder', 10);

export type LinkUserStatus = 'pending' | 'approved' | 'rejected' | 'blocked';
export type LinkSessionError = 'none' | 'replaced' | 'blocked' | 'pending' | 'rejected';
export type OwnerAction = 'approve' | 'reject' | 'block' | 'unblock' | 'signout' | 'remove';

export interface BaseLinkUser {
  _id: ObjectId;
  userId: string; // owner of the link
  slug: string;
  loginId: string;
  passwordHash: string;
  status: LinkUserStatus;
  loginAttempts: Date[]; // attempts inside the current window only (only kept when the rules block on attempts)
  currentSessionId?: string;
  sessionIssuedAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  approvedAt?: Date;
  blockedAt?: Date;
  [extra: string]: unknown;
}

export interface LinkRef {
  slug: string;
  userId: string;
  /** Stored on each account (e.g. the document or event the link belongs to). */
  extra: Record<string, unknown>;
}

export interface LinkAuthConfig {
  usersCollection: string;
  /** Distinguishes this kind of session token, so a token for one kind of link is never accepted by another. */
  tokenKind: string;
  /** Block an approved account that signs in more than MAX_LOGIN_ATTEMPTS times inside the window. */
  blockOnAttempts: boolean;
}

export function normalizeLoginId(loginId: unknown): string {
  return typeof loginId === 'string' ? loginId.trim().toLowerCase() : '';
}

export function createLinkAuth(config: LinkAuthConfig) {
  const users = (db: Db) => db.collection<BaseLinkUser>(config.usersCollection);

  let indexesReady: Promise<void> | null = null;
  function ensureIndexes(db: Db): Promise<void> {
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

  async function register(
    db: Db,
    link: LinkRef,
    rawLoginId: unknown,
    password: unknown,
    now: Date = new Date()
  ): Promise<{ ok: true } | { error: 'invalid_login_id' | 'weak_password' | 'taken' }> {
    const loginId = normalizeLoginId(rawLoginId);
    if (!LOGIN_ID_PATTERN.test(loginId)) return { error: 'invalid_login_id' };
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return { error: 'weak_password' };

    try {
      await users(db).insertOne({
        ...link.extra,
        _id: new ObjectId(),
        userId: link.userId,
        slug: link.slug,
        loginId,
        passwordHash: await bcrypt.hash(password, 10),
        status: 'pending',
        loginAttempts: [],
        createdAt: now,
      } as BaseLinkUser);
      return { ok: true };
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return { error: 'taken' };
      throw err;
    }
  }

  /**
   * Signs an account in. When the rules block on attempts, attempts on approved accounts are counted (right or wrong
   * password) and the attempt that takes the in-window count past MAX_LOGIN_ATTEMPTS blocks the account and is refused.
   * Pending accounts are never counted, so checking for approval cannot block anyone.
   */
  async function login(
    db: Db,
    slug: string,
    rawLoginId: unknown,
    password: unknown,
    now: Date = new Date()
  ): Promise<
    | { ok: true; sessionId: string; user: BaseLinkUser }
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

    let counted: BaseLinkUser = user;
    if (config.blockOnAttempts) {
      // Record this attempt and drop the ones that have left the window, atomically.
      const windowStart = new Date(now.getTime() - LOGIN_ATTEMPT_WINDOW_MS);
      const updated = await users(db).findOneAndUpdate(
        { _id: user._id, status: 'approved' },
        [
          {
            $set: {
              loginAttempts: {
                $concatArrays: [
                  { $filter: { input: { $ifNull: ['$loginAttempts', []] }, cond: { $gt: ['$$this', windowStart] } } },
                  [now],
                ],
              },
            },
          },
        ],
        { returnDocument: 'after' }
      );
      if (!updated) return { error: 'blocked' }; // blocked by a concurrent attempt or the owner
      counted = updated;

      if (counted.loginAttempts.length > MAX_LOGIN_ATTEMPTS) {
        await users(db).updateOne(
          { _id: user._id },
          { $set: { status: 'blocked', blockedAt: now }, $unset: { currentSessionId: '', sessionIssuedAt: '' } }
        );
        return { error: 'blocked' };
      }
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

  function signToken(user: Pick<BaseLinkUser, '_id' | 'slug'>, sessionId: string): string {
    return jwt.sign({ kind: config.tokenKind, luid: user._id.toHexString(), sid: sessionId, slug: user.slug }, SECRET, {
      expiresIn: LINK_SESSION_TTL_SECONDS,
    });
  }

  function readToken(token: string | undefined): { luid: string; sid: string; slug: string } | null {
    if (!token) return null;
    try {
      const payload = jwt.verify(token, SECRET) as { kind?: string; luid?: string; sid?: string; slug?: string };
      if (payload.kind !== config.tokenKind || !payload.luid || !payload.sid || !payload.slug) return null;
      return { luid: payload.luid, sid: payload.sid, slug: payload.slug };
    } catch {
      return null;
    }
  }

  /** Checks a session token for `slug`. Only the account's current session on an approved account is valid. */
  async function verifySession(
    db: Db,
    slug: string,
    token: string | undefined
  ): Promise<{ ok: true; user: BaseLinkUser } | { error: LinkSessionError }> {
    const payload = readToken(token);
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

  /** Signs the account out of its current device (the user's own sign-out). */
  async function endSession(db: Db, slug: string, token: string | undefined): Promise<void> {
    const payload = readToken(token);
    if (!payload || payload.slug !== slug || !ObjectId.isValid(payload.luid)) return;
    await users(db).updateOne(
      { _id: new ObjectId(payload.luid), slug, currentSessionId: payload.sid },
      { $unset: { currentSessionId: '', sessionIssuedAt: '' } }
    );
  }

  /** Owner-side management, always scoped to the owner's own link. Returns false when the account is not on their link. */
  async function ownerAction(
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

  /** Accounts for the owner's dashboard, without secrets. */
  async function list(db: Db, ownerId: string, slug: string) {
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

  return { ensureIndexes, register, login, signToken, readToken, verifySession, endSession, ownerAction, list };
}
