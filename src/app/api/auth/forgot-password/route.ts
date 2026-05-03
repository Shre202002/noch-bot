
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { findAccount, writeAccount } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    const account = await findAccount(email);
    if (!account) {
      // Return success even if email not found to prevent enumeration
      return NextResponse.json({ success: true });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    await writeAccount({
      ...account,
      resetToken,
      resetTokenExpiry,
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"Nocta" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Reset your Nocta password',
      html: `
        <div style="background-color: #000; color: #fff; padding: 40px; font-family: sans-serif; text-align: center;">
          <h1 style="color: #7C3AED;">NOCTA</h1>
          <p>You requested to reset your password. Click the button below to continue.</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #7C3AED; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px;">Reset Password</a>
          <p style="margin-top: 30px; font-size: 12px; color: #71717A;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}
