
import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encryptCredentials } from "@/lib/credentialCrypto";

/**
 * Handles organization-wide payment gateway configuration.
 * Credentials are verified against the provider API before being encrypted and stored.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    const body = await req.json();
    const { provider, credentials, webhook_secret } = body;

    // Provider Validation
    const supportedProviders = ['stripe', 'razorpay', 'paypal', 'cashfree'];
    if (!supportedProviders.includes(provider)) {
      return NextResponse.json({ error: "Unsupported payment provider" }, { status: 400 });
    }

    let mode: 'test' | 'live' = 'test';

    // ── Razorpay Verification ─────────────────────────────────
    if (provider === 'razorpay') {
      const { key_id, key_secret } = credentials;
      if (!key_id || !key_secret) {
        return NextResponse.json({ error: "Key ID and Key Secret are required" }, { status: 400 });
      }

      // Verify credentials with a read-only call to Razorpay
      const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');
      const rzpRes = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { 
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
      });

      const rzpData = await rzpRes.json();

      if (!rzpRes.ok) {
        console.error("[Razorpay Verification Failed]", {
          status: rzpRes.status,
          response: rzpData
        });
        
        return NextResponse.json({ 
          error: "Invalid Razorpay credentials", 
          details: rzpData.error?.description || "Authentication failed. Please check your keys."
        }, { status: 401 });
      }

      // Detect mode
      mode = key_id.startsWith('rzp_live_') ? 'live' : 'test';
      console.log(`[Razorpay Verified] Mode: ${mode}, Org: ${userId}`);
    }

    // ── Stripe Mode Detection ──────────────────────────────────
    if (provider === 'stripe') {
      const key = credentials.secret_key;
      mode = (key && key.startsWith('sk_live_')) ? 'live' : 'test';
    }

    // Encrypt credentials for storage
    const encryptedCreds = await encryptCredentials(credentials);
    
    const updateDoc: any = {
      $set: { 
        org_id: userId, 
        provider, 
        credentials: encryptedCreds, 
        mode,
        is_active: true,
        updated_at: new Date()
      }
    };

    if (webhook_secret) {
      updateDoc.$set.webhook_secret = await encryptCredentials({ secret: webhook_secret });
    }

    // Upsert the configuration for this organization (org-wide)
    await db.collection("payment_gateway_configs").updateOne(
      { org_id: userId, provider },
      updateDoc,
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true, 
      provider, 
      mode,
      is_configured: true 
    });
  } catch (error: any) {
    console.error("[payment_gateway_post] Error:", error);
    return NextResponse.json({ 
      error: "Failed to connect gateway", 
      details: error.message 
    }, { status: 500 });
  }
}
