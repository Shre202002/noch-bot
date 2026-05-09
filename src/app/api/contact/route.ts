import { NextRequest, NextResponse } from 'next/server';
import { sendContactEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 }
      );
    }

    await sendContactEmail({ name, email, phone: phone || 'Not provided', message });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[contact-api] error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}
