// COSE-HPKE library entry point

// Types
export type { KeyPair, CoseKeyMap } from './types/cose.ts';
export * from './types/cose.ts';
export * from './types/hpke.ts';

// COSE_Key operations
export {
  generateKeyPair,
  encodeCoseKey,
  decodeCoseKey,
  toDiagnostic,
  fromJwk,
  toJwk,
  coseKeyToCryptoKey,
} from './cose/key.ts';

// Errors
export { CoseError, InvalidKeyError, DecryptionError } from './errors.ts';

// Internal imports for API
import { encryptIntegrated, decryptIntegrated } from './hpke/integrated.ts';
import { encryptKeyEncryption, decryptKeyEncryption } from './hpke/key-encryption.ts';
import { decode } from './util/cbor.ts';
import { Tag } from 'cbor2';
import { COSE_ENCRYPT0_TAG, COSE_ENCRYPT_TAG } from './types/cose.ts';
import { InvalidKeyError } from './errors.ts';

/**
 * Encrypt plaintext to one or more recipients.
 *
 * - 1 recipient: Uses integrated encryption (COSE_Encrypt0)
 * - 2+ recipients: Uses key encryption (COSE_Encrypt)
 *
 * @param plaintext - The message to encrypt
 * @param recipients - Array of CBOR-encoded COSE_Key public keys
 * @returns CBOR-encoded COSE message
 */
export async function encrypt(
  plaintext: Uint8Array,
  recipients: Uint8Array[]
): Promise<Uint8Array> {
  if (recipients.length === 0) {
    throw new InvalidKeyError('At least one recipient required');
  }

  if (recipients.length === 1) {
    return encryptIntegrated(plaintext, recipients[0]!);
  }

  return encryptKeyEncryption(plaintext, recipients);
}

/**
 * Decrypt a COSE message using the recipient's private key.
 *
 * Auto-detects message format (COSE_Encrypt0 or COSE_Encrypt).
 *
 * @param coseMessage - CBOR-encoded COSE_Encrypt0 or COSE_Encrypt
 * @param privateKey - CBOR-encoded COSE_Key private key
 * @returns Decrypted plaintext
 */
export async function decrypt(
  coseMessage: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  // Detect message type by CBOR tag
  const decoded = decode(coseMessage);

  if (decoded instanceof Tag) {
    if (decoded.tag === COSE_ENCRYPT0_TAG) {
      return decryptIntegrated(coseMessage, privateKey);
    }
    if (decoded.tag === COSE_ENCRYPT_TAG) {
      return decryptKeyEncryption(coseMessage, privateKey);
    }
    throw new InvalidKeyError(`Unknown COSE tag: ${decoded.tag}`);
  }

  // Untagged - try to detect by array length
  if (Array.isArray(decoded)) {
    if (decoded.length === 3) {
      return decryptIntegrated(coseMessage, privateKey);
    }
    if (decoded.length === 4) {
      return decryptKeyEncryption(coseMessage, privateKey);
    }
  }

  throw new InvalidKeyError('Unable to determine COSE message type');
}
