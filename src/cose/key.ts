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

/**
 * Convert a COSE_Key map to a WebCrypto CryptoKey.
 */
export async function coseKeyToCryptoKey(
  coseKey: CoseKeyMap,
  type: 'public' | 'private'
): Promise<CryptoKey> {
  const kty = coseKey.get(COSE_KEY_KTY);
  if (kty !== KTY_EC2) {
    throw new InvalidKeyError(`Unsupported key type: ${kty}`, 'EC2');
  }

  const x = coseKey.get(COSE_KEY_X) as Uint8Array;
  const y = coseKey.get(COSE_KEY_Y) as Uint8Array;
  const d = coseKey.get(COSE_KEY_D) as Uint8Array | undefined;

  // Build JWK
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
  };

  if (type === 'private') {
    if (!d) {
      throw new InvalidKeyError('Private key requires d parameter', 'EC2');
    }
    jwk.d = base64UrlEncode(d);
  }

  // Import as CryptoKey - ECDH keys for HPKE
  const keyUsages: KeyUsage[] = type === 'private'
    ? ['deriveBits', 'deriveKey']
    : [];

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    keyUsages
  );
}

/**
 * Convert a JWK to CBOR-encoded COSE_Key.
 */
export async function fromJwk(jwk: JsonWebKey): Promise<Uint8Array> {
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') {
    throw new InvalidKeyError('Only P-256 EC keys supported', jwk.kty ?? 'unknown');
  }

  if (!jwk.x || !jwk.y) {
    throw new InvalidKeyError('JWK missing x or y coordinate', 'EC');
  }

  const map = new Map<number, number | Uint8Array>();
  map.set(COSE_KEY_KTY, KTY_EC2);
  map.set(COSE_KEY_CRV, CRV_P256);
  map.set(COSE_KEY_X, base64UrlDecode(jwk.x));
  map.set(COSE_KEY_Y, base64UrlDecode(jwk.y));

  if (jwk.d) {
    map.set(COSE_KEY_D, base64UrlDecode(jwk.d));
  }

  return encode(map);
}

/**
 * Convert CBOR-encoded COSE_Key to JWK.
 */
export async function toJwk(coseKeyBytes: Uint8Array): Promise<JsonWebKey> {
  const coseKey = decodeCoseKey(coseKeyBytes);

  const kty = coseKey.get(COSE_KEY_KTY);
  if (kty !== KTY_EC2) {
    throw new InvalidKeyError(`Unsupported key type for JWK: ${kty}`, 'EC2');
  }

  const x = coseKey.get(COSE_KEY_X) as Uint8Array;
  const y = coseKey.get(COSE_KEY_Y) as Uint8Array;
  const d = coseKey.get(COSE_KEY_D) as Uint8Array | undefined;

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
  };

  if (d) {
    jwk.d = base64UrlEncode(d);
  }

  return jwk;
}

/**
 * Encode bytes to base64url string.
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode base64url string to bytes.
 */
function base64UrlDecode(str: string): Uint8Array {
  // Restore standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
