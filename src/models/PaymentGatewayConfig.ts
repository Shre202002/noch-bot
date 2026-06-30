import { ObjectId } from 'mongodb';

export type SupportedPaymentProvider = 'stripe' | 'paypal' | 'razorpay' | 'cashfree';

export interface PaymentGatewayConfig {
  _id?: ObjectId;
  org_id: string; // Match UUID
  provider: SupportedPaymentProvider;
  credentials: string; // Encrypted JWE or AES string
  is_active: boolean;
}
