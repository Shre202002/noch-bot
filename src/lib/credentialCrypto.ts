/**
 * Encrypts payment gateway credentials before persisting to
 * payment_gateway_configs.credentials.
 * 
 * TODO: Phase 4 — Implement AES-256-GCM with process.env.CREDENTIAL_ENCRYPTION_KEY
 */
export async function encryptCredentials(plain: Record<string, string>): Promise<string> {
  // Stub for now
  console.log('Stub: Encrypting credentials', plain);
  throw new Error('encryptCredentials not yet implemented');
}

/**
 * Decrypts credentials in-memory only.
 */
export async function decryptCredentials(encrypted: string): Promise<Record<string, string>> {
  // Stub for now
  throw new Error('decryptCredentials not yet implemented');
}
