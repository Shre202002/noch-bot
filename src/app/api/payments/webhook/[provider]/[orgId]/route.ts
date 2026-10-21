import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { stripeAdapter } from "@/lib/payments/stripe";
import { razorpayAdapter } from "@/lib/payments/razorpay";
import { paypalAdapter } from "@/lib/payments/paypal";
import { cashfreeAdapter } from "@/lib/payments/cashfree";
import { PaymentGatewayAdapter } from "@/lib/payments/adapter";
import { decryptCredentials } from "@/lib/credentialCrypto";
import { processPaymentWebhookResult } from "@/lib/payments/processWebhookResult";

/**
 * @fileOverview Webhook receiver for payment providers without a dedicated route (PayPal, Cashfree).
 * Path: /api/payments/webhook/[provider]/[orgId]. Stripe and Razorpay have static routes that take precedence;
 * every route hands the verified result to processPaymentWebhookResult, so both booking flows (website widget
 * and chat bot) are confirmed the same way whichever provider the organizer uses.
 */

const providerAdapters: Record<string, PaymentGatewayAdapter> = {
  stripe: stripeAdapter,
  razorpay: razorpayAdapter,
  paypal: paypalAdapter,
  cashfree: cashfreeAdapter,
};

type Provider = "stripe" | "razorpay" | "paypal" | "cashfree";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; orgId: string }> }
) {
  const { provider: rawProvider, orgId } = await params;
  const provider = rawProvider.toLowerCase() as Provider;
  const adapter = providerAdapters[provider];

  try {
    if (!adapter) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const db = await getDb();
    const config = await db.collection("payment_gateway_configs").findOne({
      org_id: orgId,
      provider,
      is_active: true,
    });
    if (!config) {
      console.warn(`[webhook_${provider}] Active config not found for org: ${orgId}`);
      return NextResponse.json({ error: "Configuration not found" }, { status: 400 });
    }

    // Raw body for signature verification
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const credentials = await decryptCredentials(config.credentials);
    const webhookSecret = config.webhook_secret ? (await decryptCredentials(config.webhook_secret)).secret : null;

    const result = await adapter.verifyAndParseWebhook(rawBody, headers, credentials, webhookSecret);
    if (!result) {
      console.error(`[webhook_${provider}] Signature verification failed for org: ${orgId}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    try {
      await processPaymentWebhookResult({ provider, orgId, result });
    } catch (mutationError) {
      // Acknowledge so the provider stops retrying a request we cannot process; the event row stays unprocessed.
      console.error(`[CRITICAL_WEBHOOK_FAILURE] Manual reconciliation required.
        Booking ID: ${result.bookingId}
        Status: ${result.status}
        Error: ${mutationError instanceof Error ? mutationError.message : "Unknown"}`);
      return new NextResponse("Internal error recorded", { status: 200 });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error(`[webhook_${provider}] Global router error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
