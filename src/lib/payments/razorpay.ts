import crypto from 'crypto';
import { PaymentGatewayAdapter, CheckoutParams, WebhookResult } from './adapter';

export class RazorpayAdapter implements PaymentGatewayAdapter {
  async createCheckoutSession(params: CheckoutParams, credentials: Record<string, string>) {
    // Razorpay typically creates an 'Order' first, then the frontend opens the Modal.
    // The checkoutUrl here is a conceptual redirect to a hosted page if using Razorpay Payment Links, 
    // or we return the Order ID for the custom UI.
    
    // NOTE: This implementation assumes the use of standard Razorpay Orders.
    // In a real implementation, you would call https://api.razorpay.com/v1/orders
    return {
      checkoutUrl: '#razorpay-checkout', // Placeholder for frontend modal trigger
      providerReference: 'rzp_order_placeholder',
    };
  }

  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
    credentials: Record<string, string>,
    webhookSecret: string | null
  ): Promise<WebhookResult | null> {
    const signature = headers['x-razorpay-signature'] as string;

    if (!signature || !webhookSecret) {
      return null;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('[RazorpayAdapter] Signature mismatch');
        return null;
      }

      const payload = JSON.parse(rawBody);
      const event = payload.event;
      
      let status: WebhookResult['status'] = 'other';
      let bookingId: string | null = null;

      // Map Razorpay events to our normalized status
      if (event === 'order.paid' || event === 'payment.captured') {
        status = 'paid';
        const order = payload.payload.order?.entity || payload.payload.payment?.entity;
        bookingId = order.notes?.bookingId || null;
      } else if (event === 'payment.failed') {
        status = 'failed';
        bookingId = payload.payload.payment.entity.notes?.bookingId || null;
      }

      return {
        providerEventId: payload.account_id + '_' + payload.created_at,
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
