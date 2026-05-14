
// import { NextRequest, NextResponse } from 'next/server';
// import bcrypt from 'bcryptjs';
// import { v4 as uuidv4 } from 'uuid';
// import { findAccount, writeAccount } from '@/lib/storage';
// import { signToken } from '@/lib/auth';

// export async function POST(req: NextRequest) {
//   try {
//     const { email, password } = await req.json();

//     if (!email || !password) {
//       return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
//     }

//     if (password.length < 8) {
//       return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
//     }

//     const existingAccount = await findAccount(email);
//     if (existingAccount) {
//       return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
//     }

//     const id = uuidv4();
//     const passwordHash = await bcrypt.hash(password, 10);
//     const createdAt = new Date().toISOString();

//     await writeAccount({
//       id,
//       email,
//       passwordHash,
//       createdAt,
//       plan: 'free',
//       crawlCount: 0,
//     });

//     const token = signToken(id);
//     const response = NextResponse.json({ success: true });

//     response.cookies.set('token', token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       maxAge: 60 * 60 * 24 * 7, // 7 days
//       path: '/',
//       sameSite: 'lax',
//     });

//     return response;
//   } catch (error) {
//     console.error('Registration error:', error);
//     return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
//   }
// }






import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { findAccount, writeAccount } from '@/lib/storage';
import { signToken } from '@/lib/auth';

// ── Allowed email domains (Gmail only) ───────────────────────────
const ALLOWED_DOMAINS = ['gmail.com', 'googlemail.com'];

// ── Known temp/disposable mail providers to block ────────────────
const BLOCKED_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'spam4.me', 'trashmail.com', 'yopmail.com', 'maildrop.cc', 'dispostable.com',
  'spamgourmet.com', 'mytemp.email', 'temp-mail.org', 'fakeinbox.com',
  'discard.email', 'mailnull.com', 'spamfree24.org', 'jetable.fr.nf',
  'kynninc.com', 'trashmail.net', 'mailnesia.com', 'spamspot.com',
  'spamevader.net', 'tempr.email', 'throwam.com', 'mailnull.com',
  'spamgourmet.net', 'trashmail.io', 'throwaway.email', 'tempinbox.com',
  'getnada.com', 'mailsac.com', 'mohmal.com', 'dispostable.com',
];

function isAllowedEmail(email: string): { allowed: boolean; reason?: string } {
  const lower = email.toLowerCase().trim();
  const domain = lower.split('@')[1];

  if (!domain) return { allowed: false, reason: 'Invalid email format' };

  // Block known temp mail domains
  if (BLOCKED_DOMAINS.includes(domain)) {
    return { allowed: false, reason: 'Temporary/disposable email addresses are not allowed' };
  }

  // Only allow Gmail
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return {
      allowed: false,
      reason: 'Only Gmail accounts are allowed. Please sign up with your Gmail address or use Google Login.',
    };
  }

  return { allowed: true };
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // ── Email domain validation ───────────────────────────────
    const emailCheck = isAllowedEmail(email);
    if (!emailCheck.allowed) {
      return NextResponse.json({ error: emailCheck.reason }, { status: 400 });
    }

    const existingAccount = await findAccount(email);
    if (existingAccount) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    await writeAccount({
      id,
      email,
      passwordHash,
      createdAt,
      plan: 'free',
      crawlCount: 0,
    });

    const token = signToken(id);
    const response = NextResponse.json({ success: true });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}