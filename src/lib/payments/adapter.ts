/**
 * @fileOverview Standard interface for payment gateway providers.
 */

export interface CheckoutParams {
  bookingId: string;
  amount: number;
  currency: string;
  eventName: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
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
   * This ensures the application only ever acts on verified data.
   */
  verifyAndParseWebhook(
    rawBody: string, 
    headers: Record<string, string | string[] | undefined>, 
    credentials: Record<string, string>
  ): Promise<WebhookResult | null>;
}
