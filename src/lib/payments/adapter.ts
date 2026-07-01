/**
 * @fileOverview Standard interface for payment gateway providers.
 */

export interface CheckoutParams {
  bookingId: string;
  orgId: string;
  amount: number;
  currency: string;
  eventName: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface WebhookResult {
  providerEventId: string;
  bookingId: string | null;
  status: 'paid' | 'failed' | 'other';
  rawPayload: any;
}

export interface PaymentGatewayAdapter {
  /**
   * Creates a checkout session or order on the provider's platform.
   * For redirect-based providers (Stripe, PayPal), checkoutUrl is populated.
   * For SDK-based providers (Razorpay, Cashfree), providerReference contains the Session/Order ID.
   */
  createCheckoutSession(
    params: CheckoutParams, 
    credentials: Record<string, string>
  ): Promise<{ 
    checkoutUrl: string; 
    providerReference: string; 
  }>;

  /**
   * Atomically verifies the cryptographic signature and parses the payload.
   * Returns a normalized WebhookResult on success, or null if verification fails.
   */
  verifyAndParseWebhook(
    rawBody: string, 
    headers: Record<string, string | string[] | undefined>, 
    credentials: Record<string, string>,
    webhookSecret: string | null
  ): Promise<WebhookResult | null>;
}
