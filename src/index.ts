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

// Suite management
export {
  setDefaultSuite,
  getDefaultSuite,
  getSuiteConfig,
  getSuiteFromAlg,
  getHpkeSuite,
  getHpke7Suite,
} from './hpke/suite.ts';

// Errors
export { CoseError, InvalidKeyError, DecryptionError } from './errors.ts';

// Internal imports for API
import { encryptIntegrated, decryptIntegrated, type IntegratedEncryptOptions } from './hpke/integrated.ts';
import { encryptKeyEncryption, decryptKeyEncryption, type KeyEncryptionOptions } from './hpke/key-encryption.ts';
import { decode } from './util/cbor.ts';
import { Tag } from 'cbor2';
import { COSE_ENCRYPT0_TAG, COSE_ENCRYPT_TAG } from './types/cose.ts';
import { InvalidKeyError } from './errors.ts';
import type { HpkeSuiteId } from './types/hpke.ts';

/**
 * Options for encryption operations
 */
export interface EncryptOptions {
  suiteId?: HpkeSuiteId;
  externalAad?: Uint8Array;
  externalInfo?: Uint8Array;        // For integrated encryption
  recipientExtraInfo?: Uint8Array;  // For key encryption
}

/**
 * Options for decryption operations
 */
export interface DecryptOptions {
  suiteId?: HpkeSuiteId;
  externalAad?: Uint8Array;
  externalInfo?: Uint8Array;        // For integrated encryption
  recipientExtraInfo?: Uint8Array;  // For key encryption
}

/**
 * Encrypt plaintext to one or more recipients.
 *
 * - 1 recipient: Uses integrated encryption (COSE_Encrypt0)
 * - 2+ recipients: Uses key encryption (COSE_Encrypt)
 *
 * @param plaintext - The message to encrypt
 * @param recipients - Array of CBOR-encoded COSE_Key public keys
 * @param options - Optional encryption parameters
 * @returns CBOR-encoded COSE message
 */
export async function encrypt(
  plaintext: Uint8Array,
  recipients: Uint8Array[],
  options: EncryptOptions = {}
): Promise<Uint8Array> {
  if (recipients.length === 0) {
    throw new InvalidKeyError('At least one recipient required');
  }

  if (recipients.length === 1) {
    const integratedOptions: IntegratedEncryptOptions = {
      suiteId: options.suiteId,
      externalAad: options.externalAad,
      externalInfo: options.externalInfo,
    };
    return encryptIntegrated(plaintext, recipients[0]!, integratedOptions);
  }

  const keyEncryptionOptions: KeyEncryptionOptions = {
    suiteId: options.suiteId,
    externalAad: options.externalAad,
    recipientExtraInfo: options.recipientExtraInfo,
  };
  return encryptKeyEncryption(plaintext, recipients, keyEncryptionOptions);
}

/**
 * Decrypt a COSE message using the recipient's private key.
 *
 * Auto-detects message format (COSE_Encrypt0 or COSE_Encrypt).
 *
 * @param coseMessage - CBOR-encoded COSE_Encrypt0 or COSE_Encrypt
 * @param privateKey - CBOR-encoded COSE_Key private key
 * @param options - Optional decryption parameters
 * @returns Decrypted plaintext
 */
export async function decrypt(
  coseMessage: Uint8Array,
  privateKey: Uint8Array,
  options: DecryptOptions = {}
): Promise<Uint8Array> {
  // Detect message type by CBOR tag
  const decoded = decode(coseMessage);

  if (decoded instanceof Tag) {
    if (decoded.tag === COSE_ENCRYPT0_TAG) {
      const integratedOptions: IntegratedEncryptOptions = {
        suiteId: options.suiteId,
        externalAad: options.externalAad,
        externalInfo: options.externalInfo,
      };
      return decryptIntegrated(coseMessage, privateKey, integratedOptions);
    }
    if (decoded.tag === COSE_ENCRYPT_TAG) {
      const keyEncryptionOptions: KeyEncryptionOptions = {
        suiteId: options.suiteId,
        externalAad: options.externalAad,
        recipientExtraInfo: options.recipientExtraInfo,
      };
      return decryptKeyEncryption(coseMessage, privateKey, keyEncryptionOptions);
    }
    throw new InvalidKeyError(`Unknown COSE tag: ${decoded.tag}`);
  }

  // Untagged - try to detect by array length
  if (Array.isArray(decoded)) {
    if (decoded.length === 3) {
      const integratedOptions: IntegratedEncryptOptions = {
        suiteId: options.suiteId,
        externalAad: options.externalAad,
        externalInfo: options.externalInfo,
      };
      return decryptIntegrated(coseMessage, privateKey, integratedOptions);
    }
    if (decoded.length === 4) {
      const keyEncryptionOptions: KeyEncryptionOptions = {
        suiteId: options.suiteId,
        externalAad: options.externalAad,
        recipientExtraInfo: options.recipientExtraInfo,
      };
      return decryptKeyEncryption(coseMessage, privateKey, keyEncryptionOptions);
    }
  }

  throw new InvalidKeyError('Unable to determine COSE message type');
}

// URL transport
export * from './url/index.ts';
