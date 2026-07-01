import crypto from 'crypto';
import { PaymentGatewayAdapter, CheckoutParams, WebhookResult } from './adapter';

export class CashfreeAdapter implements PaymentGatewayAdapter {
  private getApiBase(): string {
    return process.env.CASHFREE_MODE === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
  }

  async createCheckoutSession(params: CheckoutParams, credentials: Record<string, string>) {
    const baseUrl = process.env.NEXTAUTH_URL || '';
    
    const response = await fetch(`${this.getApiBase()}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': credentials.app_id,
        'x-client-secret': credentials.secret_key,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: `order_${params.bookingId}_${Date.now()}`,
        order_amount: params.amount,
        order_currency: params.currency.toUpperCase(),
        order_meta: {
          return_url: `${params.successUrl}?order_id={order_id}`,
          notify_url: `${baseUrl}/api/payments/webhook/cashfree/${params.orgId}`,
        },
        customer_details: {
          customer_id: params.bookingId,
          customer_phone: params.customerPhone || '9999999999',
          customer_email: params.customerEmail || 'no-reply@nochbot.space'
        },
        order_tags: {
          bookingId: params.bookingId
        }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Cashfree Order creation failed: ${err}`);
    }

    const order = await response.json();

    return {
      // Cashfree V3 uses an SDK-based flow. payment_session_id is used by the JS SDK.
      checkoutUrl: '', 
      providerReference: order.payment_session_id,
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
