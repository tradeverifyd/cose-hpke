// Integrated encryption mode using COSE_Encrypt0 (single recipient)
import { getHpke7Suite } from './suite.ts';
import { buildProtectedHeader, buildUnprotectedHeader } from '../cose/headers.ts';
import { buildEncStructure } from '../cose/aad.ts';
import { buildCoseEncrypt0, parseCoseEncrypt0 } from '../cose/encrypt0.ts';
import { decodeCoseKey, coseKeyToCryptoKey } from '../cose/key.ts';
import { ALG_HPKE_7_INTEGRATED, HEADER_EK } from '../types/hpke.ts';
import { DecryptionError } from '../errors.ts';

/**
 * Encrypt plaintext to a single recipient using integrated encryption (COSE_Encrypt0).
 *
 * @param plaintext - The message to encrypt
 * @param recipientPublicKey - CBOR-encoded COSE_Key public key
 * @returns CBOR-encoded COSE_Encrypt0 message
 */
export async function encryptIntegrated(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array
): Promise<Uint8Array> {
  const suite = getHpke7Suite();

  // Decode recipient's COSE_Key and convert to CryptoKey
  const recipientCoseKey = decodeCoseKey(recipientPublicKey);
  const recipientCryptoKey = await coseKeyToCryptoKey(recipientCoseKey, 'public');

  // Build protected header
  const protectedHeader = buildProtectedHeader(ALG_HPKE_7_INTEGRATED);

  // Build AAD (Enc_structure)
  const aad = buildEncStructure('Encrypt0', protectedHeader);

  // HPKE Seal
  const { encapsulatedSecret, ciphertext } = await suite.Seal(
    recipientCryptoKey,
    plaintext,
    { aad }
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
 * @returns Decrypted plaintext
 */
export async function decryptIntegrated(
  coseMessage: Uint8Array,
  recipientPrivateKey: Uint8Array
): Promise<Uint8Array> {
  const suite = getHpke7Suite();

  // Parse COSE_Encrypt0
  const encrypt0 = parseCoseEncrypt0(coseMessage);

  // Get encapsulated key from unprotected header
  const ek = encrypt0.unprotectedHeader.get(HEADER_EK) as Uint8Array;
  if (!ek) {
    throw new DecryptionError('Missing encapsulated key (ek) in header');
  }

  // Decode private key
  const privateCoseKey = decodeCoseKey(recipientPrivateKey);
  const privateCryptoKey = await coseKeyToCryptoKey(privateCoseKey, 'private');

  // Build AAD (must match encryption)
  const aad = buildEncStructure('Encrypt0', encrypt0.protectedHeader);

  // HPKE Open
  try {
    const plaintext = await suite.Open(
      privateCryptoKey,
      ek,
      encrypt0.ciphertext,
      { aad }
    );
    return new Uint8Array(plaintext);
  } catch (error) {
    throw new DecryptionError(
      'Decryption failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
