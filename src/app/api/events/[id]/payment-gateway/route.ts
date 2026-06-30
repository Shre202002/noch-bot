import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encryptCredentials } from "@/lib/credentialCrypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { provider, credentials } = body;

    const supportedProviders = ["stripe", "paypal", "razorpay", "cashfree"];
    if (!provider || !supportedProviders.includes(provider)) {
      return NextResponse.json({ error: "Unsupported or missing provider" }, { status: 400 });
    }

    if (!credentials || typeof credentials !== "object") {
      return NextResponse.json({ error: "Provider credentials are required" }, { status: 400 });
    }

    // 1. Basic field validation per provider (Phase 2 Group 3 stubs)
    // TODO: Phase 4 — Actual test call to provider API
    if (provider === "stripe" && !credentials.secret_key) {
      return NextResponse.json({ error: "secret_key is required for Stripe" }, { status: 400 });
    }
    if (provider === "razorpay" && (!credentials.key_id || !credentials.key_secret)) {
      return NextResponse.json({ error: "key_id and key_secret are required for Razorpay" }, { status: 400 });
    }

    // 2. Encrypt credentials
    let encrypted;
    try {
      encrypted = await encryptCredentials(credentials);
    } catch (err: any) {
      // Phase 1 stub throws "not yet implemented"
      if (err.message === "encryptCredentials not yet implemented") {
        return NextResponse.json({ error: "Payment encryption not yet active. Phase 4 pending." }, { status: 501 });
      }
      throw err;
    }

    // 3. Upsert configuration
    const db = await getDb();
    await db.collection("payment_gateway_configs").updateOne(
      { org_id: userId, provider },
      { 
        $set: { 
          org_id: userId,
          provider,
          credentials: encrypted,
          is_active: true
        } 
      },
      { upsert: true }
    );

    // 4. Response shape (Never return raw or encrypted credentials)
    return NextResponse.json({ 
      success: true, 
      data: { provider, is_active: true } 
    });

  } catch (error) {
    console.error("[payment_gateway_post]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
