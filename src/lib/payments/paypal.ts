import { PaymentGatewayAdapter, CheckoutParams, WebhookResult } from './adapter';

export class PaypalAdapter implements PaymentGatewayAdapter {
  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const auth = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');
    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
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
    // Placeholder for PayPal V2 Orders API implementation
    return {
      checkoutUrl: 'https://www.paypal.com/checkoutnow?token=placeholder',
      providerReference: 'PAYPAL_ORDER_ID',
    };
  }

  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
    credentials: Record<string, string>,
    webhookId: string | null // For PayPal, the "secret" is the Webhook ID
  ): Promise<WebhookResult | null> {
    if (!webhookId) return null;

    try {
      const accessToken = await this.getAccessToken(credentials);
      const payload = JSON.parse(rawBody);

      // PayPal requires a verification call back to their API
      const verifyResponse = await fetch('https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature', {
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
        console.warn('[PaypalAdapter] Signature verification failed');
        return null;
      }

      let status: WebhookResult['status'] = 'other';
      const eventType = payload.event_type;

      if (eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        status = 'paid';
      } else if (eventType === 'PAYMENT.CAPTURE.DENIED') {
        status = 'failed';
      }

      // Try to find bookingId in customs/metadata
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
