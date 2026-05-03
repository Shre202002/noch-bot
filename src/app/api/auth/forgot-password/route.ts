import { NextRequest, NextResponse } from 'next/server';
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

    // Generate a 6-digit verification code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    await writeAccount({
      ...account,
      resetToken: resetCode, // Reusing resetToken field for OTP code
      resetTokenExpiry,
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"Nocta" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `${resetCode} is your Nocta verification code`,
      html: `
        <div style="background-color: #000; color: #fff; padding: 40px; font-family: sans-serif; text-align: center;">
          <h1 style="color: #7C3AED; font-size: 32px; letter-spacing: -1px;">NOCTA</h1>
          <p style="color: #71717A; font-size: 16px;">Enter this code to verify your identity and reset your password:</p>
          <div style="display: inline-block; background-color: #161B22; border: 1px solid #2A2A2A; color: #fff; padding: 16px 32px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 24px 0;">
            ${resetCode}
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #71717A;">This code will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
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