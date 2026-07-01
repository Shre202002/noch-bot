
import Stripe from 'stripe';
import { PaymentGatewayAdapter, CheckoutParams, WebhookResult } from './adapter';

export class StripeAdapter implements PaymentGatewayAdapter {
  private getClient(secretKey: string): Stripe {
    return new Stripe(secretKey, {
      apiVersion: '2025-01-27-preview', // Use a stable or latest version
    });
  }

  async createCheckoutSession(params: CheckoutParams, credentials: Record<string, string>) {
    const stripe = this.getClient(credentials.secret_key);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: params.eventName,
            description: `Booking for ${params.quantity} ticket(s)`,
          },
          unit_amount: Math.round(params.amount * 100), // Stripe expects cents
        },
        quantity: params.quantity,
      }],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        bookingId: params.bookingId,
      },
      client_reference_id: params.bookingId,
    });

    return {
      checkoutUrl: session.url!,
      providerReference: session.id,
    };
  }

  async verifyWebhookSignature(
    rawBody: string, 
    headers: Record<string, string | string[] | undefined>, 
    credentials: Record<string, string>
  ) {
    const stripe = this.getClient(credentials.secret_key);
    const sig = headers['stripe-signature'] as string;
    const webhookSecret = credentials.webhook_secret;

    if (!sig || !webhookSecret) return false;

    try {
      stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      return true;
    } catch (err) {
      console.warn('[StripeAdapter] Signature verification failed:', err);
      return false;
    }
  }

  parseWebhookPayload(body: any): WebhookResult {
    const event = body as Stripe.Event;
    let bookingId: string | null = null;
    let status: WebhookResult['status'] = 'other';

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      bookingId = session.metadata?.bookingId || session.client_reference_id || null;
      status = session.payment_status === 'paid' ? 'paid' : 'failed';
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      bookingId = session.metadata?.bookingId || null;
      status = 'failed';
    }

    return {
      providerEventId: event.id,
      bookingId,
      status,
      rawPayload: body,
    };
  }
}

// Export singleton
export const stripeAdapter = new StripeAdapter();
