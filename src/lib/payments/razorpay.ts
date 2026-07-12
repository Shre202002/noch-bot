import crypto from 'crypto';
import { PaymentGatewayAdapter, CheckoutParams, WebhookResult, CheckoutResult } from './adapter';

export class RazorpayAdapter implements PaymentGatewayAdapter {
  async createCheckoutSession(params: CheckoutParams, credentials: Record<string, string>): Promise<CheckoutResult> {
    const auth = Buffer.from(`${credentials.key_id}:${credentials.key_secret}`).toString('base64');
    
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(params.amount * 100),
        currency: params.currency.toUpperCase(),
        receipt: params.bookingId,
        notes: {
          bookingId: params.bookingId
        }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Razorpay Order creation failed: ${err}`);
    }

    const order = await response.json();
    
    const appBaseUrl = process.env.NEXTAUTH_URL;
    if (!appBaseUrl) throw new Error("NEXTAUTH_URL is required for Razorpay payment bridge checkoutUrl");

    return {
      checkoutUrl: `${appBaseUrl}/booking/pay/${params.bookingId}`,
      providerOrderId: order.id,
      providerReference: order.id,
      rawResponse: order
    };
  }

  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
    credentials: Record<string, string>,
    webhookSecret: string | null
  ): Promise<WebhookResult | null> {
    const signature = headers['x-razorpay-signature'] as string;
    const eventId = headers['x-razorpay-event-id'] as string;

    if (!signature || !webhookSecret || !eventId) {
      return null;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        return null;
      }

      const payload = JSON.parse(rawBody);
      const event = payload.event;
      
      let status: WebhookResult['status'] = 'other';
      let bookingId: string | null = null;

      const entity = payload.payload.order?.entity || payload.payload.payment?.entity;
      bookingId = entity?.notes?.bookingId || entity?.receipt || null;

      if (event === 'order.paid' || event === 'payment.captured') {
        status = 'paid';
      } else if (event === 'payment.failed') {
        status = 'failed';
      }

      return {
        providerEventId: eventId,
        bookingId,
        status,
        rawPayload: payload,
      };
    } catch (err) {
      console.error('[RazorpayAdapter] Webhook error:', err);
      return null;
    }
  }
}

export const razorpayAdapter = new RazorpayAdapter();
