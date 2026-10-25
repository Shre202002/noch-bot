import { NextRequest, NextResponse } from "next/server";
import { findAccount, updateAccount, writeAccount } from "@/lib/storage";
import { signToken } from "@/lib/auth";
import { ensureBootstrapAdmin } from "@/lib/superAdmin";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");

    if (!code) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/login?error=google_failed`
        );
    }

    try {
        // Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/google/callback`,
                grant_type: "authorization_code",
            }),
        });

        const tokens = await tokenRes.json();
        console.log("tokens:", tokens);
        // Get user info from Google
        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        const googleUser = await userRes.json();

        console.log("googleUser:", googleUser);

        if (!googleUser.email) {
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/login?error=no_email`
            );
        }

        // Find or create account
        let account = await findAccount(googleUser.email);

        if (!account) {
            const id = uuid();
            account = {
                id,
                email: googleUser.email,
                passwordHash: "", // no password for Google users
                createdAt: new Date().toISOString(),
                plan: "free",
                crawlCount: 0,
                googleId: googleUser.id,
                name: googleUser.name,
                avatar: googleUser.picture,
                emailVerified: true,
                emailVerifiedAt: new Date().toISOString(),
            };
            await writeAccount(account);
        } else if (account.emailVerified === false) {
            // Signing in with Google proves the mailbox belongs to this person.
            await updateAccount(account.id, { emailVerified: true, emailVerifiedAt: new Date().toISOString() });
        }

        if (account.disabled) {
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/login?error=account_disabled`
            );
        }

        await ensureBootstrapAdmin(account);

        // Create JWT and set cookie
        const token = signToken(account.id);
        const res = NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/dashboard`
        );
        res.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
        });

        return res;
    } catch (error) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/login?error=google_failed`
        );
    }
}