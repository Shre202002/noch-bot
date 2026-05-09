import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findAccount, saveOtp } from '@/lib/storage'
import { sendOtpEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email is required.' },
        { status: 400 }
      )
    }

    // Check if user exists — return error if not
    const account = await findAccount(email.toLowerCase().trim())

    if (!account) {
      return NextResponse.json(
        { success: false, message: 'This email is not registered with Nochq.' },
        { status: 400 }
      )
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // Hash OTP before storing
    const otpHash = await bcrypt.hash(otp, 10)

    // Expiry: 5 minutes from now
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    // Save hashed OTP to DB
    await saveOtp(email.toLowerCase().trim(), otpHash, otpExpiry)

    // Send OTP email
    await sendOtpEmail(email, otp)

    return NextResponse.json(
      { success: true, message: 'OTP sent to your email.' },
      { status: 200 }
    )

  } catch (err) {
    console.error('[forgot-password] error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to send OTP. Please try again.' },
      { status: 500 }
    )
  }
}