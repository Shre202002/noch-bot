import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { razorpayAdapter } from "@/lib/payments/razorpay";
import { decryptCredentials } from "@/lib/credentialCrypto";
import { processPaymentWebhookResult } from "@/lib/payments/processWebhookResult";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  try {
    const db = await getDb();
    const gateway = await db.collection("payment_gateway_configs").findOne({
      org_id: orgId,
      provider: "razorpay",
      is_active: true
    });

    if (!gateway) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    const credentials = await decryptCredentials(gateway.credentials);
    const webhookSecret = gateway.webhook_secret 
      ? (await decryptCredentials(gateway.webhook_secret)).secret 
      : null;

    const result = await razorpayAdapter.verifyAndParseWebhook(
      rawBody,
      headers,
      credentials,
      webhookSecret
    );

    if (!result) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    await processPaymentWebhookResult({
      provider: 'razorpay',
      orgId,
      result
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[razorpay_webhook_error]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
