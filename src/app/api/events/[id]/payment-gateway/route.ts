import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encryptCredentials } from "@/lib/credentialCrypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);

    // 1. Ownership/Existence Check
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const body = await req.json();
    const { provider, credentials } = body;

    // 2. Provider Validation
    const supportedProviders = ['stripe', 'paypal', 'razorpay', 'cashfree'];
    if (!supportedProviders.includes(provider)) {
      return NextResponse.json({ error: "Unsupported payment provider" }, { status: 400 });
    }

    // 3. Credential Shape Validation
    if (!credentials || typeof credentials !== 'object') {
      return NextResponse.json({ error: "Credentials required" }, { status: 400 });
    }

    if (provider === 'stripe' && !credentials.secret_key) {
      return NextResponse.json({ error: "Stripe requires secret_key" }, { status: 400 });
    }
    if (provider === 'razorpay' && (!credentials.key_id || !credentials.key_secret)) {
      return NextResponse.json({ error: "Razorpay requires key_id and key_secret" }, { status: 400 });
    }
    if (provider === 'paypal' && (!credentials.client_id || !credentials.client_secret)) {
      return NextResponse.json({ error: "PayPal requires client_id and client_secret" }, { status: 400 });
    }
    if (provider === 'cashfree' && (!credentials.app_id || !credentials.secret_key)) {
      return NextResponse.json({ error: "Cashfree requires app_id and secret_key" }, { status: 400 });
    }

    // 4. Encrypt and Upsert (Org-scoped)
    try {
      // TODO: Phase 4 — real provider validation call
      const encrypted = await encryptCredentials(credentials);
      
      await db.collection("payment_gateway_configs").updateOne(
        { org_id: userId, provider },
        { 
          $set: { 
            org_id: userId, 
            provider, 
            credentials: encrypted, 
            is_active: true,
            updated_at: new Date()
          } 
        },
        { upsert: true }
      );

      return NextResponse.json({ success: true, provider, is_active: true });
    } catch (error: any) {
      if (error.message === 'encryptCredentials not yet implemented') {
        return NextResponse.json({ error: "Encryption not yet implemented (Phase 4)" }, { status: 501 });
      }
      throw error;
    }
  } catch (error) {
    console.error("[payment_gateway_post]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
