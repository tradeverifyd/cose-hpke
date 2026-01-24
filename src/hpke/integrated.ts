// Integrated encryption mode using COSE_Encrypt0 (single recipient)
import { getHpkeSuite, getSuiteConfig, getSuiteFromAlg } from './suite.ts';
import { buildProtectedHeader, buildUnprotectedHeader, parseProtectedHeader } from '../cose/headers.ts';
import { buildEncStructure } from '../cose/aad.ts';
import { buildCoseEncrypt0, parseCoseEncrypt0 } from '../cose/encrypt0.ts';
import { decodeCoseKey, coseKeyToCryptoKey } from '../cose/key.ts';
import { HEADER_ALG, HEADER_EK, type HpkeSuiteId } from '../types/hpke.ts';
import { DecryptionError } from '../errors.ts';

/**
 * Options for integrated encryption operations
 */
export interface IntegratedEncryptOptions {
  suiteId?: HpkeSuiteId;
  externalAad?: Uint8Array;
  externalInfo?: Uint8Array;
}

/**
 * Encrypt plaintext to a single recipient using integrated encryption (COSE_Encrypt0).
 *
 * @param plaintext - The message to encrypt
 * @param recipientPublicKey - CBOR-encoded COSE_Key public key
 * @param options - Optional encryption parameters
 * @returns CBOR-encoded COSE_Encrypt0 message
 */
export async function encryptIntegrated(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
  options: IntegratedEncryptOptions = {}
): Promise<Uint8Array> {
  const config = getSuiteConfig(options.suiteId);
  const suite = getHpkeSuite(options.suiteId);

  // Decode recipient's COSE_Key and convert to CryptoKey
  const recipientCoseKey = decodeCoseKey(recipientPublicKey);
  const recipientCryptoKey = await coseKeyToCryptoKey(recipientCoseKey, 'public');

  // Build protected header
  const protectedHeader = buildProtectedHeader(config.integratedAlg);

  // Build AAD (Enc_structure) with external AAD if provided
  const aad = buildEncStructure('Encrypt0', protectedHeader, options.externalAad);

  // HPKE Seal with optional external info
  const sealOptions: { aad: Uint8Array; info?: Uint8Array } = { aad };
  if (options.externalInfo) {
    sealOptions.info = options.externalInfo;
  }

  const { encapsulatedSecret, ciphertext } = await suite.Seal(
    recipientCryptoKey,
    plaintext,
    sealOptions
  );

  // Build unprotected header with encapsulated key
  const unprotectedHeader = buildUnprotectedHeader(new Uint8Array(encapsulatedSecret));

  // Build and return COSE_Encrypt0
  return buildCoseEncrypt0({
    protectedHeader,
    unprotectedHeader,
    ciphertext: new Uint8Array(ciphertext),
  });
}

/**
 * Decrypt a COSE_Encrypt0 message using the recipient's private key.
 *
 * @param coseMessage - CBOR-encoded COSE_Encrypt0 message
 * @param recipientPrivateKey - CBOR-encoded COSE_Key private key
 * @param options - Optional decryption parameters
 * @returns Decrypted plaintext
 */
export async function decryptIntegrated(
  coseMessage: Uint8Array,
  recipientPrivateKey: Uint8Array,
  options: IntegratedEncryptOptions = {}
): Promise<Uint8Array> {
  // Parse COSE_Encrypt0
  const encrypt0 = parseCoseEncrypt0(coseMessage);

  // Get encapsulated key from unprotected header
  const ek = encrypt0.unprotectedHeader.get(HEADER_EK) as Uint8Array;
  if (!ek) {
    throw new DecryptionError('Missing encapsulated key (ek) in header');
  }

  // Parse protected header to get algorithm
  const protectedHeaderMap = parseProtectedHeader(encrypt0.protectedHeader);
  const alg = protectedHeaderMap.get(HEADER_ALG) as number;

  // Determine suite from algorithm or use provided suite
  const suiteId = options.suiteId ?? getSuiteFromAlg(alg) ?? undefined;
  const suite = getHpkeSuite(suiteId);

  // Decode private key
  const privateCoseKey = decodeCoseKey(recipientPrivateKey);
  const privateCryptoKey = await coseKeyToCryptoKey(privateCoseKey, 'private');

  // Build AAD (must match encryption)
  const aad = buildEncStructure('Encrypt0', encrypt0.protectedHeader, options.externalAad);

  // HPKE Open with optional external info
  const openOptions: { aad: Uint8Array; info?: Uint8Array } = { aad };
  if (options.externalInfo) {
    openOptions.info = options.externalInfo;
  }

  try {
    const plaintext = await suite.Open(
      privateCryptoKey,
      ek,
      encrypt0.ciphertext,
      openOptions
    );
    return new Uint8Array(plaintext);
  } catch (error) {
    throw new DecryptionError(
      'Decryption failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
