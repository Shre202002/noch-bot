import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { findAccountById, type Account } from '@/lib/storage';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

type VerifiableAccount = Pick<Account, 'emailVerified'> | null | undefined;

/**
 * Only an explicit `false` is unverified. Email/password signups are created that way; accounts that predate
 * verification have no value and keep working, and Google sign-ins are stored as verified.
 */
export function needsEmailVerification(account: VerifiableAccount): boolean {
  return account?.emailVerified === false;
}

export const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED';

export function verificationRequiredResponse(headers?: HeadersInit): NextResponse {
  return NextResponse.json(
    { error: 'Verify your email address in Account settings to set up your assistant.', code: EMAIL_NOT_VERIFIED_CODE },
    { status: 403, headers },
  );
}

/** Returns a 403 response when the signed-in owner has not verified their email, otherwise null. */
export async function requireVerifiedEmail(userId: string, headers?: HeadersInit): Promise<NextResponse | null> {
  const account = await findAccountById(userId);
  return needsEmailVerification(account) ? verificationRequiredResponse(headers) : null;
}

export type IssueResult =
  | { ok: true; otp: string }
  | { ok: false; status: number; error: string; retryAfterSec?: number };

/** Creates and stores a fresh code (hashed). The caller emails the returned plain code and never logs it. */
export async function issueEmailOtp(account: Account, now: number = Date.now()): Promise<IssueResult> {
  if (!needsEmailVerification(account)) {
    return { ok: false, status: 400, error: 'Your email is already verified.' };
  }

  const sentAt = account.emailOtpSentAt ? Date.parse(account.emailOtpSentAt) : NaN;
  if (Number.isFinite(sentAt) && now - sentAt < RESEND_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - (now - sentAt)) / 1000);
    return { ok: false, status: 429, error: `Please wait ${retryAfterSec}s before requesting another code.`, retryAfterSec };
  }

  const otp = String(randomInt(100000, 1000000));
  const db = await getDb();
  await db.collection('accounts').updateOne(
    { id: account.id },
    {
      $set: {
        emailOtpHash: await bcrypt.hash(otp, 10),
        emailOtpExpiry: new Date(now + OTP_TTL_MS).toISOString(),
        emailOtpSentAt: new Date(now).toISOString(),
        emailOtpAttempts: 0,
      },
    },
  );
  return { ok: true, otp };
}

export type ConfirmResult = { ok: true } | { ok: false; status: number; error: string };

const OTP_FIELDS = { emailOtpHash: '', emailOtpExpiry: '', emailOtpSentAt: '', emailOtpAttempts: '' } as const;

export async function confirmEmailOtp(account: Account, code: unknown, now: number = Date.now()): Promise<ConfirmResult> {
  if (!needsEmailVerification(account)) return { ok: true };
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    return { ok: false, status: 400, error: 'Enter the 6-digit code.' };
  }
  if (!account.emailOtpHash || !account.emailOtpExpiry) {
    return { ok: false, status: 400, error: 'Request a verification code first.' };
  }

  const db = await getDb();
  const accounts = db.collection('accounts');

  if (now > Date.parse(account.emailOtpExpiry)) {
    await accounts.updateOne({ id: account.id }, { $unset: OTP_FIELDS });
    return { ok: false, status: 400, error: 'That code has expired. Request a new one.' };
  }

  // Count the attempt before comparing so parallel guesses cannot exceed the limit.
  const updated = await accounts.findOneAndUpdate(
    { id: account.id },
    { $inc: { emailOtpAttempts: 1 } },
    { returnDocument: 'after', projection: { emailOtpAttempts: 1 } },
  );
  const attempts = (updated?.emailOtpAttempts as number | undefined) ?? MAX_OTP_ATTEMPTS;
  if (attempts > MAX_OTP_ATTEMPTS) {
    await accounts.updateOne({ id: account.id }, { $unset: OTP_FIELDS });
    return { ok: false, status: 429, error: 'Too many wrong codes. Request a new one.' };
  }

  if (!(await bcrypt.compare(code.trim(), account.emailOtpHash))) {
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await accounts.updateOne({ id: account.id }, { $unset: OTP_FIELDS });
      return { ok: false, status: 429, error: 'Too many wrong codes. Request a new one.' };
    }
    return { ok: false, status: 400, error: 'That code is not correct.' };
  }

  await accounts.updateOne(
    { id: account.id },
    { $set: { emailVerified: true, emailVerifiedAt: new Date(now).toISOString() }, $unset: OTP_FIELDS },
  );
  return { ok: true };
}
