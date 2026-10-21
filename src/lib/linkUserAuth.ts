import type { ObjectId, Db } from 'mongodb';
import {
  createLinkAuth,
  LINK_SESSION_TTL_SECONDS,
  LOGIN_ATTEMPT_WINDOW_MS,
  MAX_LOGIN_ATTEMPTS,
  normalizeLoginId,
  type LinkSessionError,
  type LinkUserStatus,
  type OwnerAction,
} from './linkAuthCore';
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

export { LINK_SESSION_TTL_SECONDS, LOGIN_ATTEMPT_WINDOW_MS, MAX_LOGIN_ATTEMPTS, normalizeLoginId };
export type { LinkSessionError, LinkUserStatus, OwnerAction };

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

/** A live share link that requires sign-in, or null (missing, deleted, or public). */
export async function findProtectedLink(db: Db, slug: string): Promise<ProtectedLink | null> {
  const link = await db
    .collection(PDF_LINKS_COLLECTION)
    .findOne({ slug, requireLogin: true, ...NOT_DELETED });
  return link ? { slug: link.slug, userId: link.userId, fileId: link.fileId } : null;
}

// The shared rules (register, approve, one device at a time, session tokens) live in linkAuthCore.ts; PDF links also block an
// approved account after repeated sign-ins.
const core = createLinkAuth({ usersCollection: PDF_LINK_USERS_COLLECTION, tokenKind: 'link', blockOnAttempts: true });

export const ensureLinkUserIndexes = core.ensureIndexes;

export const registerLinkUser = (db: Db, link: ProtectedLink, rawLoginId: unknown, password: unknown, now?: Date) =>
  core.register(db, { slug: link.slug, userId: link.userId, extra: { fileId: link.fileId } }, rawLoginId, password, now);

export const attemptLinkLogin = core.login as (
  db: Db,
  slug: string,
  rawLoginId: unknown,
  password: unknown,
  now?: Date
) => Promise<{ ok: true; sessionId: string; user: LinkUser } | { error: 'invalid' | 'pending' | 'rejected' | 'blocked' }>;

export const signLinkToken = core.signToken;
export const readLinkToken = core.readToken;

export const verifyLinkSession = core.verifySession as (
  db: Db,
  slug: string,
  token: string | undefined
) => Promise<{ ok: true; user: LinkUser } | { error: LinkSessionError }>;

export const endLinkSession = core.endSession;
export const ownerLinkUserAction = core.ownerAction;
export const listLinkUsers = core.list;
