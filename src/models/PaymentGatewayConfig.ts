import { ObjectId } from 'mongodb';

export type SupportedPaymentProvider = 'stripe' | 'paypal' | 'razorpay' | 'cashfree';

export interface PaymentGatewayConfig {
  _id?: ObjectId;
  org_id: string; // Match UUID
  provider: SupportedPaymentProvider;
  credentials: string; // Encrypted JWE or AES string
  webhook_secret: string | null; // Encrypted separately from credentials
  is_active: boolean;
}
