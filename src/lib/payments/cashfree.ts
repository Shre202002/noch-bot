import crypto from 'crypto';
import { PaymentGatewayAdapter, CheckoutParams, WebhookResult } from './adapter';

export class CashfreeAdapter implements PaymentGatewayAdapter {
  async createCheckoutSession(params: CheckoutParams, credentials: Record<string, string>) {
    return {
      checkoutUrl: 'https://payments.cashfree.com/order/placeholder',
      providerReference: 'CF_ORDER_ID',
    };
  }

  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
    credentials: Record<string, string>,
    webhookSecret: string | null
  ): Promise<WebhookResult | null> {
    const signature = headers['x-webhook-signature'] as string;
    const timestamp = headers['x-webhook-timestamp'] as string;

    if (!signature || !timestamp || !webhookSecret) return null;

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(timestamp + rawBody)
        .digest('base64');

      if (expectedSignature !== signature) {
        console.warn('[CashfreeAdapter] Signature mismatch');
        return null;
      }

      const payload = JSON.parse(rawBody);
      const data = payload.data;
      
      let status: WebhookResult['status'] = 'other';
      if (payload.type === 'PAYMENT_SUCCESS_WEBHOOK') {
        status = 'paid';
      } else if (payload.type === 'PAYMENT_FAILED_WEBHOOK') {
        status = 'failed';
      }

      return {
        providerEventId: data.payment.cf_payment_id.toString(),
        bookingId: data.order.order_tags?.bookingId || null,
        status,
        rawPayload: payload,
      };
    } catch (err) {
      console.error('[CashfreeAdapter] Webhook error:', err);
      return null;
    }
  }
}

export const cashfreeAdapter = new CashfreeAdapter();
