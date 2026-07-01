import { PaymentGatewayAdapter, CheckoutParams, WebhookResult } from './adapter';

export class PaypalAdapter implements PaymentGatewayAdapter {
  private getApiBase(): string {
    return process.env.PAYPAL_MODE === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const auth = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');
    const response = await fetch(`${this.getApiBase()}/v1/oauth2/token`, {
      method: 'POST',
      body: 'grant_type=client_credentials',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) throw new Error('Failed to get PayPal access token');
    const data = await response.json();
    return data.access_token;
  }

  async createCheckoutSession(params: CheckoutParams, credentials: Record<string, string>) {
    const accessToken = await this.getAccessToken(credentials);
    
    const response = await fetch(`${this.getApiBase()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: params.bookingId,
          custom_id: params.bookingId,
          amount: {
            currency_code: params.currency.toUpperCase(),
            value: params.amount.toString(),
          },
          description: `${params.eventName} - ${params.quantity} tickets`
        }],
        application_context: {
          return_url: params.successUrl,
          cancel_url: params.cancelUrl,
          user_action: 'PAY_NOW'
        }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PayPal Order creation failed: ${err}`);
    }

    const order = await response.json();
    const approveLink = order.links.find((l: any) => l.rel === 'approve');

    return {
      checkoutUrl: approveLink.href,
      providerReference: order.id,
    };
  }

  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
    credentials: Record<string, string>,
    webhookId: string | null
  ): Promise<WebhookResult | null> {
    if (!webhookId) return null;

    try {
      const accessToken = await this.getAccessToken(credentials);
      const payload = JSON.parse(rawBody);

      const verifyResponse = await fetch(`${this.getApiBase()}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transmission_id: headers['paypal-transmission-id'],
          transmission_time: headers['paypal-transmission-time'],
          cert_url: headers['paypal-cert-url'],
          auth_algo: headers['paypal-auth-algo'],
          transmission_sig: headers['paypal-transmission-sig'],
          webhook_id: webhookId,
          webhook_event: payload,
        }),
      });

      if (!verifyResponse.ok) return null;
      const verification = await verifyResponse.json();

      if (verification.verification_status !== 'SUCCESS') {
        return null;
      }

      let status: WebhookResult['status'] = 'other';
      const eventType = payload.event_type;

      if (eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        status = 'paid';
      } else if (eventType === 'PAYMENT.CAPTURE.DENIED') {
        status = 'failed';
      }

      const bookingId = payload.resource.custom_id || payload.resource.purchase_units?.[0]?.custom_id || null;

      return {
        providerEventId: payload.id,
        bookingId,
        status,
        rawPayload: payload,
      };
    } catch (err) {
      console.error('[PaypalAdapter] Verification error:', err);
      return null;
    }
  }
}

export const paypalAdapter = new PaypalAdapter();
