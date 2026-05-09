import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_APP_PASSWORD!,
  },
})

// Verify transporter on startup
transporter.verify((error) => {
  if (error) {
    console.error('[mailer] SMTP connection failed:', error)
  } else {
    console.log('[mailer] SMTP ready')
  }
})

export async function sendOtpEmail(
  to: string,
  otp: string
): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"NochBot AI" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Your NochBot Password Reset OTP',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:12px;">
          <h2 style="margin:0 0 8px;color:#36f4a4;font-size:24px;">Password Reset</h2>
          <p style="color:#7d8187;margin:0 0 32px;">
            Use the OTP below to reset your NochBot password. Valid for 5 minutes.
          </p>
          <div style="background:#1f2228;border:1px solid #2a2d35;border-radius:8px;padding:24px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:700;color:#36f4a4;">
            ${otp}
          </div>
          <p style="color:#4a4e56;font-size:13px;margin-top:24px;">
            If you did not request this, ignore this email. Your password will not change.
          </p>
        </div>
      `,
    })
    console.log('[mailer] OTP email sent to:', to)
  } catch (err) {
    console.error('[mailer] Failed to send email:', err)
    throw err
  }
}

export async function sendContactEmail(data: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"NochBot Contact" <${process.env.GMAIL_USER}>`,
      to: 'sriyanshgupta24@gmail.com',
      subject: `New Contact Form Submission from ${data.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:12px;border:1px solid #2a2d35;">
          <h2 style="margin:0 0 16px;color:#36f4a4;font-size:20px;border-bottom:1px solid #2a2d35;padding-bottom:12px;">New Contact Submission</h2>
          <div style="margin-bottom:20px;">
            <p style="margin:0 0 8px;"><strong style="color:#7d8187;font-size:12px;text-transform:uppercase;">Name:</strong><br/>${data.name}</p>
            <p style="margin:0 0 8px;"><strong style="color:#7d8187;font-size:12px;text-transform:uppercase;">Email:</strong><br/>${data.email}</p>
            <p style="margin:0 0 8px;"><strong style="color:#7d8187;font-size:12px;text-transform:uppercase;">Phone:</strong><br/>${data.phone}</p>
          </div>
          <div style="background:#1f2228;padding:20px;border-radius:8px;border:1px solid #2a2d35;">
            <strong style="color:#7d8187;font-size:12px;text-transform:uppercase;display:block;margin-bottom:8px;">Message:</strong>
            <p style="margin:0;line-height:1.6;color:#e5e7eb;">${data.message}</p>
          </div>
          <p style="color:#4a4e56;font-size:11px;margin-top:24px;text-align:center;">
            This message was sent via the NochBot Landing Page contact form.
          </p>
        </div>
      `,
    })
    console.log('[mailer] Contact email sent')
  } catch (err) {
    console.error('[mailer] Failed to send contact email:', err)
    throw err
  }
}
