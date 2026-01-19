// COSE_Key operations for P-256 EC2 keys
import {
  CipherSuite,
  KEM_DHKEM_P256_HKDF_SHA256,
  KDF_HKDF_SHA256,
  AEAD_AES_256_GCM,
} from 'hpke';
import { encode, decode, toDiagnosticNotation } from '../util/cbor.ts';
import {
  KTY_EC2,
  CRV_P256,
  COSE_KEY_KTY,
  COSE_KEY_CRV,
  COSE_KEY_X,
  COSE_KEY_Y,
  COSE_KEY_D,
  type KeyPair,
  type CoseKeyMap,
} from '../types/cose.ts';
import { InvalidKeyError } from '../errors.ts';

// HPKE-7: DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM
const suite = new CipherSuite(
  KEM_DHKEM_P256_HKDF_SHA256,
  KDF_HKDF_SHA256,
  AEAD_AES_256_GCM
);

/**
 * Generate a P-256 keypair in COSE_Key format.
 * Returns CBOR-encoded public and private keys.
 */
export async function generateKeyPair(): Promise<KeyPair> {
  // Generate P-256 keypair with extractable private key
  const { publicKey, privateKey } = await suite.GenerateKeyPair(true);

  // Serialize to raw bytes - P-256 public key is 65 bytes (0x04 prefix + 32 bytes x + 32 bytes y)
  const pubBytes = await suite.SerializePublicKey(publicKey);
  // P-256 private key is 32 bytes (scalar d)
  const privBytes = await suite.SerializePrivateKey(privateKey);

  // Build COSE_Key maps from raw bytes
  const pubCoseKey = buildCoseKeyEC2Public(pubBytes);
  const privCoseKey = buildCoseKeyEC2Private(pubBytes, privBytes);

  return {
    publicKey: encode(pubCoseKey),
    privateKey: encode(privCoseKey),
  };
}

/**
 * Build a COSE_Key map for EC2 public key from raw bytes.
 * P-256 uncompressed public key is 65 bytes: 0x04 || x (32 bytes) || y (32 bytes)
 */
function buildCoseKeyEC2Public(pubBytes: Uint8Array): CoseKeyMap {
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new InvalidKeyError('Invalid P-256 public key format', 'EC2');
  }

  const x = pubBytes.slice(1, 33);
  const y = pubBytes.slice(33, 65);

  const map = new Map<number, number | Uint8Array>();
  map.set(COSE_KEY_KTY, KTY_EC2);
  map.set(COSE_KEY_CRV, CRV_P256);
  map.set(COSE_KEY_X, x);
  map.set(COSE_KEY_Y, y);

  return map;
}

/**
 * Build a COSE_Key map for EC2 private key from raw bytes.
 * Includes both public coordinates and private scalar.
 */
function buildCoseKeyEC2Private(
  pubBytes: Uint8Array,
  privBytes: Uint8Array
): CoseKeyMap {
  if (privBytes.length !== 32) {
    throw new InvalidKeyError('Invalid P-256 private key format', 'EC2');
  }

  const map = buildCoseKeyEC2Public(pubBytes);
  map.set(COSE_KEY_D, privBytes);

  return map;
}

/**
 * Encode a CoseKeyMap to CBOR bytes.
 */
export function encodeCoseKey(keyMap: CoseKeyMap): Uint8Array {
  return encode(keyMap);
}

/**
 * Decode CBOR bytes to a CoseKeyMap.
 * Validates required fields for EC2 keys.
 */
export function decodeCoseKey(bytes: Uint8Array): CoseKeyMap {
  const decoded = decode(bytes);
  if (!(decoded instanceof Map)) {
    throw new InvalidKeyError('COSE_Key must be a CBOR map');
  }

  // Validate required fields
  const kty = decoded.get(COSE_KEY_KTY);
  if (kty !== KTY_EC2) {
    throw new InvalidKeyError(`Unsupported key type: ${kty}`, 'EC2');
  }

  return decoded as CoseKeyMap;
}

/**
 * Convert CBOR-encoded COSE_Key to CDDL diagnostic notation.
 */
export function toDiagnostic(coseKeyBytes: Uint8Array): string {
  return toDiagnosticNotation(coseKeyBytes);
}
