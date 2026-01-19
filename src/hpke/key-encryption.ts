// Key encryption mode using COSE_Encrypt (multi-recipient)
import { getHpke7Suite } from './suite.ts';
import { buildProtectedHeader, buildUnprotectedHeader } from '../cose/headers.ts';
import { buildEncStructure } from '../cose/aad.ts';
import { buildCoseEncrypt, parseCoseEncrypt } from '../cose/encrypt.ts';
import { type CoseRecipient } from '../cose/recipient.ts';
import { decodeCoseKey, coseKeyToCryptoKey } from '../cose/key.ts';
import { ALG_HPKE_7_KEY_ENCRYPTION, HEADER_EK } from '../types/hpke.ts';
import { DecryptionError, InvalidKeyError } from '../errors.ts';
import { encode } from '../util/cbor.ts';

// AES-256-GCM parameters
const CEK_LENGTH = 32;  // 256 bits for AES-256
const IV_LENGTH = 12;   // 96 bits for GCM
const HEADER_IV = 5;    // IV parameter label

/**
 * Encrypt plaintext to multiple recipients using key encryption mode (COSE_Encrypt).
 *
 * @param plaintext - The message to encrypt
 * @param recipientPublicKeys - Array of CBOR-encoded COSE_Key public keys
 * @returns CBOR-encoded COSE_Encrypt message
 */
export async function encryptKeyEncryption(
  plaintext: Uint8Array,
  recipientPublicKeys: Uint8Array[]
): Promise<Uint8Array> {
  if (recipientPublicKeys.length === 0) {
    throw new InvalidKeyError('At least one recipient required');
  }

  // Generate random CEK (Content Encryption Key)
  const cek = crypto.getRandomValues(new Uint8Array(CEK_LENGTH));

  // Build protected header for content layer (empty, recipients provide alg)
  const contentProtectedHeader = encode(new Map());

  // Generate random IV for content encryption
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Import CEK for AES-GCM
  const contentKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // AAD for content encryption
  const contentAad = buildEncStructure('Encrypt', contentProtectedHeader);

  // Encrypt content with CEK using AES-256-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: contentAad as BufferSource },
    contentKey,
    plaintext as BufferSource
  );

  // Content unprotected header contains IV
  const contentUnprotectedHeader = new Map<number, Uint8Array>();
  contentUnprotectedHeader.set(HEADER_IV, iv);

  // Encrypt CEK to each recipient using HPKE
  const recipients: CoseRecipient[] = [];
  const suite = getHpke7Suite();

  for (const pubKeyBytes of recipientPublicKeys) {
    const coseKey = decodeCoseKey(pubKeyBytes);
    const cryptoKey = await coseKeyToCryptoKey(coseKey, 'public');

    // Recipient protected header
    const recipientProtectedHeader = buildProtectedHeader(ALG_HPKE_7_KEY_ENCRYPTION);

    // AAD for recipient
    const recipientAad = buildEncStructure('Enc_Recipient', recipientProtectedHeader);

    // HPKE seal the CEK
    const { encapsulatedSecret, ciphertext: encryptedCek } = await suite.Seal(
      cryptoKey,
      cek,
      { aad: recipientAad }
    );

    // Recipient unprotected header with encapsulated key
    const recipientUnprotectedHeader = buildUnprotectedHeader(new Uint8Array(encapsulatedSecret));

    recipients.push({
      protectedHeader: recipientProtectedHeader,
      unprotectedHeader: recipientUnprotectedHeader,
      ciphertext: new Uint8Array(encryptedCek),
    });
  }

  // Build COSE_Encrypt
  return buildCoseEncrypt({
    protectedHeader: contentProtectedHeader,
    unprotectedHeader: contentUnprotectedHeader,
    ciphertext: new Uint8Array(ciphertext),
    recipients,
  });
}

/**
 * Decrypt a COSE_Encrypt message using the recipient's private key.
 *
 * @param coseMessage - CBOR-encoded COSE_Encrypt message
 * @param recipientPrivateKey - CBOR-encoded COSE_Key private key
 * @returns Decrypted plaintext
 */
export async function decryptKeyEncryption(
  coseMessage: Uint8Array,
  recipientPrivateKey: Uint8Array
): Promise<Uint8Array> {
  const suite = getHpke7Suite();
  const coseEncrypt = parseCoseEncrypt(coseMessage);

  // Decode private key
  const privateCoseKey = decodeCoseKey(recipientPrivateKey);
  const privateCryptoKey = await coseKeyToCryptoKey(privateCoseKey, 'private');

  // Try each recipient layer to find one that works with our key
  let cek: Uint8Array | null = null;

  for (const recipient of coseEncrypt.recipients) {
    try {
      const ek = recipient.unprotectedHeader.get(HEADER_EK) as Uint8Array;
      if (!ek) continue;

      // AAD for recipient
      const recipientAad = buildEncStructure('Enc_Recipient', recipient.protectedHeader);

      // HPKE open to get CEK
      const decryptedCek = await suite.Open(
        privateCryptoKey,
        ek,
        recipient.ciphertext,
        { aad: recipientAad }
      );
      cek = new Uint8Array(decryptedCek);
      break;
    } catch {
      // Try next recipient
      continue;
    }
  }

  if (!cek) {
    throw new DecryptionError('No matching recipient found for the provided key');
  }

  // Decrypt content with CEK
  const iv = coseEncrypt.unprotectedHeader.get(HEADER_IV) as Uint8Array;
  if (!iv) {
    throw new DecryptionError('Missing IV in content unprotected header');
  }

  const contentKey = await crypto.subtle.importKey(
    'raw',
    cek as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const contentAad = buildEncStructure('Encrypt', coseEncrypt.protectedHeader);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: contentAad as BufferSource },
      contentKey,
      coseEncrypt.ciphertext as BufferSource
    );

    return new Uint8Array(plaintext);
  } catch (error) {
    throw new DecryptionError(
      'Content decryption failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
