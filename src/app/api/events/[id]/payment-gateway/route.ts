
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encryptCredentials } from "@/lib/credentialCrypto";

/**
 * Handles organization-wide payment gateway configuration.
 * Credentials are encrypted before being stored in the database.
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

    // Encrypt credentials
    const encryptedCreds = await encryptCredentials(credentials);
    
    const updateDoc: any = {
      $set: { 
        org_id: userId, 
        provider, 
        credentials: encryptedCreds, 
        is_active: true,
        updated_at: new Date()
      }
    };

    if (webhook_secret) {
      updateDoc.$set.webhook_secret = await encryptCredentials({ secret: webhook_secret });
    }

    // Upsert the configuration for this organization
    await db.collection("payment_gateway_configs").updateOne(
      { org_id: userId, provider },
      updateDoc,
      { upsert: true }
    );

    return NextResponse.json({ success: true, provider, is_configured: true });
  } catch (error: any) {
    console.error("[payment_gateway_post]", error);
    return NextResponse.json({ error: "Failed to connect gateway" }, { status: 500 });
  }
}
