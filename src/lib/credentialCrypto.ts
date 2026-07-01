
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Gets the encryption key from environment.
 * Must be 32 bytes (64 hex characters).
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('CRITICAL: CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string.');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts payment gateway credentials using AES-256-GCM.
 * Output format: iv:authTag:encryptedData (hex)
 */
export async function encryptCredentials(plain: Record<string, string>): Promise<string> {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const jsonStr = JSON.stringify(plain);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Return formatted string for storage
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts credentials in-memory.
 */
export async function decryptCredentials(encrypted: string): Promise<Record<string, string>> {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format.');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}
