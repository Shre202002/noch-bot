import Stripe from 'stripe';
import { PaymentGatewayAdapter, CheckoutParams, WebhookResult, CheckoutResult } from './adapter';

export class StripeAdapter implements PaymentGatewayAdapter {
  private getClient(secretKey: string): Stripe {
    return new Stripe(secretKey, {
      apiVersion: '2024-06-20',
    });
  }

  async createCheckoutSession(params: CheckoutParams, credentials: Record<string, string>): Promise<CheckoutResult> {
    const stripe = this.getClient(credentials.secret_key);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: params.customerEmail,
      line_items: [{
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: params.eventName,
            description: `Booking for ${params.quantity} ticket(s)`,
          },
          unit_amount: Math.round((params.amount / params.quantity) * 100),
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
      providerOrderId: session.id,
      providerReference: session.id,
      rawResponse: session
    };
  }

  async verifyAndParseWebhook(
    rawBody: string, 
    headers: Record<string, string | string[] | undefined>, 
    credentials: Record<string, string>,
    webhookSecret: string | null
  ): Promise<WebhookResult | null> {
    const stripe = this.getClient(credentials.secret_key);
    const sig = headers['stripe-signature'] as string;

    if (!sig || !webhookSecret) return null;

    try {
      const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      
      let bookingId: string | null = null;
      let status: WebhookResult['status'] = 'other';
      let providerPaymentId: string | undefined;
      let providerOrderId: string | undefined;

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        bookingId = session.metadata?.bookingId || session.client_reference_id || null;
        status = session.payment_status === 'paid' ? 'paid' : 'failed';
        providerPaymentId = typeof session.payment_intent === 'string' ? session.payment_intent : undefined;
        providerOrderId = session.id;
      } else if (event.type === 'checkout.session.async_payment_failed') {
        const session = event.data.object as Stripe.Checkout.Session;
        bookingId = session.metadata?.bookingId || null;
        status = 'failed';
        providerOrderId = session.id;
      }

      return {
        providerEventId: event.id,
        bookingId,
        status,
        rawPayload: event,
        providerPaymentId,
        providerOrderId
      };
    } catch (err) {
      return null;
    }
  }
}

export const stripeAdapter = new StripeAdapter();
