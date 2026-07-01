
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
  createCheckoutSession(params: CheckoutParams, credentials: Record<string, string>): Promise<{ 
    checkoutUrl: string; 
    providerReference: string; 
  }>;

  /**
   * Verifies the cryptographic signature of an incoming webhook.
   */
  verifyWebhookSignature(
    rawBody: string, 
    headers: Record<string, string | string[] | undefined>, 
    credentials: Record<string, string>
  ): Promise<boolean>;

  /**
   * Parses the provider's webhook payload into a normalized result.
   */
  parseWebhookPayload(body: any): WebhookResult;
}
