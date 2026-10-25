import { NextRequest, NextResponse } from 'next/server';
import { EMAIL_RE, saveLead } from '@/lib/leads';
import { clientIp, rateLimited } from '@/lib/ipRateLimit';

/** Public email sign-up from blog, tool and newsletter forms. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const source = typeof body.source === 'string' ? body.source : 'unknown';

    // Bots fill the hidden field; pretend it worked.
    if (typeof body.website === 'string' && body.website) return NextResponse.json({ success: true });

    if (rateLimited(`leads:${clientIp(req)}`)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again in a minute.' }, { status: 429 });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    await saveLead({ email, source });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[leads_api] error:', error);
    return NextResponse.json({ error: 'Could not save your email. Please try again later.' }, { status: 500 });
  }
}
