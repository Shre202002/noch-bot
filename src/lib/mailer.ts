
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_APP_PASSWORD!,
  },
});

export async function sendOtpEmail(
  to: string,
  otp: string
): Promise<void> {
  await transporter.sendMail({
    from: `"Nocta AI" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Your Nocta password reset OTP',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:12px;">
        <h2 style="margin:0 0 8px;color:#36f4a4;font-size:24px;">Password Reset</h2>
        <p style="color:#7d8187;margin:0 0 32px;">Use the OTP below to reset your Nocta password. Valid for 5 minutes.</p>
        <div style="background:#1f2228;border:1px solid #2a2d35;border-radius:8px;padding:24px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:700;color:#36f4a4;">
          ${otp}
        </div>
        <p style="color:#4a4e56;font-size:13px;margin-top:24px;">
          If you did not request this, ignore this email. Your password will not change.
        </p>
      </div>
    `,
  });
}
