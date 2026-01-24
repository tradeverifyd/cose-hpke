// Key encryption mode using COSE_Encrypt (multi-recipient)
import { getHpkeSuite, getSuiteConfig, getSuiteFromAlg } from './suite.ts';
import { buildProtectedHeader, buildUnprotectedHeader, parseProtectedHeader } from '../cose/headers.ts';
import { buildEncStructure } from '../cose/aad.ts';
import { buildRecipientStructure } from '../cose/recipient-structure.ts';
import { buildCoseEncrypt, parseCoseEncrypt } from '../cose/encrypt.ts';
import { type CoseRecipient } from '../cose/recipient.ts';
import { decodeCoseKey, coseKeyToCryptoKey } from '../cose/key.ts';
import { HEADER_ALG, HEADER_EK, type HpkeSuiteId } from '../types/hpke.ts';
import { DecryptionError, InvalidKeyError } from '../errors.ts';

// AES-256-GCM parameters
const CEK_LENGTH = 32;  // 256 bits for AES-256
const IV_LENGTH = 12;   // 96 bits for GCM
const HEADER_IV = 5;    // IV parameter label

/**
 * Options for key encryption operations
 */
export interface KeyEncryptionOptions {
  suiteId?: HpkeSuiteId;
  externalAad?: Uint8Array;
  recipientExtraInfo?: Uint8Array;
}

/**
 * Encrypt plaintext to multiple recipients using key encryption mode (COSE_Encrypt).
 *
 * @param plaintext - The message to encrypt
 * @param recipientPublicKeys - Array of CBOR-encoded COSE_Key public keys
 * @param options - Optional encryption parameters
 * @returns CBOR-encoded COSE_Encrypt message
 */
export async function encryptKeyEncryption(
  plaintext: Uint8Array,
  recipientPublicKeys: Uint8Array[],
  options: KeyEncryptionOptions = {}
): Promise<Uint8Array> {
  if (recipientPublicKeys.length === 0) {
    throw new InvalidKeyError('At least one recipient required');
  }

  const config = getSuiteConfig(options.suiteId);
  const suite = getHpkeSuite(options.suiteId);

  // Generate random CEK (Content Encryption Key)
  const cek = crypto.getRandomValues(new Uint8Array(CEK_LENGTH));

  // Build protected header for content layer with algorithm
  const contentProtectedHeader = buildProtectedHeader(config.contentAlg);

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

  // AAD for content encryption (includes external AAD if provided)
  const contentAad = buildEncStructure(
    'Encrypt',
    contentProtectedHeader,
    options.externalAad
  );

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
  const recipientExtraInfo = options.recipientExtraInfo ?? new Uint8Array();

  for (const pubKeyBytes of recipientPublicKeys) {
    const coseKey = decodeCoseKey(pubKeyBytes);
    const cryptoKey = await coseKeyToCryptoKey(coseKey, 'public');

    // Recipient protected header
    const recipientProtectedHeader = buildProtectedHeader(config.keyEncryptionAlg);

    // Build Recipient_structure for HPKE info per draft-20
    const hpkeInfo = buildRecipientStructure(
      config.contentAlg,
      recipientProtectedHeader,
      recipientExtraInfo
    );

    // HPKE seal the CEK with info parameter (AAD is empty per draft-20)
    const { encapsulatedSecret, ciphertext: encryptedCek } = await suite.Seal(
      cryptoKey,
      cek,
      { info: hpkeInfo, aad: new Uint8Array() }
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
 * @param options - Optional decryption parameters
 * @returns Decrypted plaintext
 */
export async function decryptKeyEncryption(
  coseMessage: Uint8Array,
  recipientPrivateKey: Uint8Array,
  options: KeyEncryptionOptions = {}
): Promise<Uint8Array> {
  const coseEncrypt = parseCoseEncrypt(coseMessage);

  // Parse content protected header to get content algorithm
  const contentHeader = parseProtectedHeader(coseEncrypt.protectedHeader);
  const contentAlg = contentHeader.get(HEADER_ALG) as number | undefined;

  // Decode private key
  const privateCoseKey = decodeCoseKey(recipientPrivateKey);
  const privateCryptoKey = await coseKeyToCryptoKey(privateCoseKey, 'private');

  // Try each recipient layer to find one that works with our key
  let cek: Uint8Array | null = null;
  const recipientExtraInfo = options.recipientExtraInfo ?? new Uint8Array();

  for (const recipient of coseEncrypt.recipients) {
    try {
      const ek = recipient.unprotectedHeader.get(HEADER_EK) as Uint8Array;
      if (!ek) continue;

      // Parse recipient protected header to get algorithm
      const recipientHeader = parseProtectedHeader(recipient.protectedHeader);
      const recipientAlg = recipientHeader.get(HEADER_ALG) as number;

      // Determine suite from algorithm
      const suiteId = options.suiteId ?? getSuiteFromAlg(recipientAlg);
      if (!suiteId) continue;

      const suite = getHpkeSuite(suiteId);
      const config = getSuiteConfig(suiteId);

      // Build Recipient_structure for HPKE info per draft-20
      const nextLayerAlg = contentAlg ?? config.contentAlg;
      const hpkeInfo = buildRecipientStructure(
        nextLayerAlg,
        recipient.protectedHeader,
        recipientExtraInfo
      );

      // HPKE open to get CEK (AAD is empty per draft-20)
      const decryptedCek = await suite.Open(
        privateCryptoKey,
        ek,
        recipient.ciphertext,
        { info: hpkeInfo, aad: new Uint8Array() }
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

  // AAD for content decryption (includes external AAD if provided)
  const contentAad = buildEncStructure(
    'Encrypt',
    coseEncrypt.protectedHeader,
    options.externalAad
  );

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
