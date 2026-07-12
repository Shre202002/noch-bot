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
  providerPaymentId?: string;
  providerOrderId?: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerReference?: string;
  rawResponse?: any;
}

export interface PaymentGatewayAdapter {
  /**
   * Creates a checkout session or order on the provider's platform.
   */
  createCheckoutSession(
    params: CheckoutParams, 
    credentials: Record<string, string>
  ): Promise<CheckoutResult>;

  /**
   * Atomically verifies the cryptographic signature and parses the payload.
   */
  verifyAndParseWebhook(
    rawBody: string, 
    headers: Record<string, string | string[] | undefined>, 
    credentials: Record<string, string>,
    webhookSecret: string | null
  ): Promise<WebhookResult | null>;
}
