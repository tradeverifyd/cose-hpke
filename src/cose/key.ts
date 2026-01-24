// COSE_Key operations for EC2 and OKP keys
import {
  CipherSuite,
  KEM_DHKEM_P256_HKDF_SHA256,
  KEM_DHKEM_X25519_HKDF_SHA256,
  KDF_HKDF_SHA256,
  AEAD_AES_256_GCM,
  AEAD_ChaCha20Poly1305,
} from 'hpke';
import { encode, decode, toDiagnosticNotation } from '../util/cbor.ts';
import {
  KTY_EC2,
  KTY_OKP,
  CRV_P256,
  CRV_X25519,
  COSE_KEY_KTY,
  COSE_KEY_ALG,
  COSE_KEY_CRV,
  COSE_KEY_X,
  COSE_KEY_Y,
  COSE_KEY_D,
  type KeyPair,
  type CoseKeyMap,
} from '../types/cose.ts';
import {
  ALG_HPKE_7_INTEGRATED,
  ALG_HPKE_4_INTEGRATED,
  type HpkeSuiteId,
} from '../types/hpke.ts';
import { InvalidKeyError } from '../errors.ts';

// Cipher suites for key generation
function getP256Suite(): CipherSuite {
  return new CipherSuite(
    KEM_DHKEM_P256_HKDF_SHA256,
    KDF_HKDF_SHA256,
    AEAD_AES_256_GCM
  );
}

function getX25519Suite(): CipherSuite {
  return new CipherSuite(
    KEM_DHKEM_X25519_HKDF_SHA256,
    KDF_HKDF_SHA256,
    AEAD_ChaCha20Poly1305
  );
}

/**
 * Generate a keypair in COSE_Key format.
 * Returns CBOR-encoded public and private keys.
 *
 * @param suiteId - Suite identifier to determine key type (default: HPKE-7 / P-256)
 */
export async function generateKeyPair(suiteId?: HpkeSuiteId): Promise<KeyPair> {
  const id = suiteId ?? 'HPKE-7';

  if (id === 'HPKE-4') {
    return generateX25519KeyPair();
  }

  return generateP256KeyPair();
}

/**
 * Generate a P-256 keypair (HPKE-7)
 */
async function generateP256KeyPair(): Promise<KeyPair> {
  const suite = getP256Suite();

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
 * Generate an X25519 keypair (HPKE-4)
 */
async function generateX25519KeyPair(): Promise<KeyPair> {
  const suite = getX25519Suite();

  // Generate X25519 keypair with extractable private key
  const { publicKey, privateKey } = await suite.GenerateKeyPair(true);

  // Serialize to raw bytes - X25519 public key is 32 bytes
  const pubBytes = await suite.SerializePublicKey(publicKey);
  // X25519 private key is 32 bytes
  const privBytes = await suite.SerializePrivateKey(privateKey);

  // Build COSE_Key maps from raw bytes
  const pubCoseKey = buildCoseKeyOKPPublic(pubBytes);
  const privCoseKey = buildCoseKeyOKPPrivate(pubBytes, privBytes);

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
  map.set(COSE_KEY_ALG, ALG_HPKE_7_INTEGRATED);
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
 * Build a COSE_Key map for OKP public key from raw bytes.
 * X25519 public key is 32 bytes.
 */
function buildCoseKeyOKPPublic(pubBytes: Uint8Array): CoseKeyMap {
  if (pubBytes.length !== 32) {
    throw new InvalidKeyError('Invalid X25519 public key format', 'OKP');
  }

  const map = new Map<number, number | Uint8Array>();
  map.set(COSE_KEY_KTY, KTY_OKP);
  map.set(COSE_KEY_ALG, ALG_HPKE_4_INTEGRATED);
  map.set(COSE_KEY_CRV, CRV_X25519);
  map.set(COSE_KEY_X, pubBytes);

  return map;
}

/**
 * Build a COSE_Key map for OKP private key from raw bytes.
 * Includes both public key and private key.
 */
function buildCoseKeyOKPPrivate(
  pubBytes: Uint8Array,
  privBytes: Uint8Array
): CoseKeyMap {
  if (privBytes.length !== 32) {
    throw new InvalidKeyError('Invalid X25519 private key format', 'OKP');
  }

  const map = buildCoseKeyOKPPublic(pubBytes);
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
 * Validates required fields for EC2 and OKP keys.
 */
export function decodeCoseKey(bytes: Uint8Array): CoseKeyMap {
  const decoded = decode(bytes);
  if (!(decoded instanceof Map)) {
    throw new InvalidKeyError('COSE_Key must be a CBOR map');
  }

  // Validate required fields
  const kty = decoded.get(COSE_KEY_KTY);
  if (kty !== KTY_EC2 && kty !== KTY_OKP) {
    throw new InvalidKeyError(`Unsupported key type: ${kty}`, 'EC2 or OKP');
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

  if (kty === KTY_OKP) {
    return coseKeyOKPToCryptoKey(coseKey, type);
  }

  if (kty === KTY_EC2) {
    return coseKeyEC2ToCryptoKey(coseKey, type);
  }

  throw new InvalidKeyError(`Unsupported key type: ${kty}`, 'EC2 or OKP');
}

/**
 * Convert EC2 COSE_Key to CryptoKey
 */
async function coseKeyEC2ToCryptoKey(
  coseKey: CoseKeyMap,
  type: 'public' | 'private'
): Promise<CryptoKey> {
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
 * Convert OKP COSE_Key to CryptoKey
 */
async function coseKeyOKPToCryptoKey(
  coseKey: CoseKeyMap,
  type: 'public' | 'private'
): Promise<CryptoKey> {
  const x = coseKey.get(COSE_KEY_X) as Uint8Array;
  const d = coseKey.get(COSE_KEY_D) as Uint8Array | undefined;

  // Build JWK for X25519
  const jwk: JsonWebKey = {
    kty: 'OKP',
    crv: 'X25519',
    x: base64UrlEncode(x),
  };

  if (type === 'private') {
    if (!d) {
      throw new InvalidKeyError('Private key requires d parameter', 'OKP');
    }
    jwk.d = base64UrlEncode(d);
  }

  // Import as CryptoKey - X25519 keys for HPKE
  const keyUsages: KeyUsage[] = type === 'private'
    ? ['deriveBits', 'deriveKey']
    : [];

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'X25519' },
    true,
    keyUsages
  );
}

/**
 * Convert a JWK to CBOR-encoded COSE_Key.
 */
export async function fromJwk(jwk: JsonWebKey): Promise<Uint8Array> {
  // Handle OKP (X25519)
  if (jwk.kty === 'OKP' && jwk.crv === 'X25519') {
    if (!jwk.x) {
      throw new InvalidKeyError('JWK missing x coordinate', 'OKP');
    }

    const map = new Map<number, number | Uint8Array>();
    map.set(COSE_KEY_KTY, KTY_OKP);
    map.set(COSE_KEY_ALG, ALG_HPKE_4_INTEGRATED);
    map.set(COSE_KEY_CRV, CRV_X25519);
    map.set(COSE_KEY_X, base64UrlDecode(jwk.x));

    if (jwk.d) {
      map.set(COSE_KEY_D, base64UrlDecode(jwk.d));
    }

    return encode(map);
  }

  // Handle EC (P-256)
  if (jwk.kty === 'EC' && jwk.crv === 'P-256') {
    if (!jwk.x || !jwk.y) {
      throw new InvalidKeyError('JWK missing x or y coordinate', 'EC');
    }

    const map = new Map<number, number | Uint8Array>();
    map.set(COSE_KEY_KTY, KTY_EC2);
    map.set(COSE_KEY_ALG, ALG_HPKE_7_INTEGRATED);
    map.set(COSE_KEY_CRV, CRV_P256);
    map.set(COSE_KEY_X, base64UrlDecode(jwk.x));
    map.set(COSE_KEY_Y, base64UrlDecode(jwk.y));

    if (jwk.d) {
      map.set(COSE_KEY_D, base64UrlDecode(jwk.d));
    }

    return encode(map);
  }

  throw new InvalidKeyError(`Unsupported JWK type: ${jwk.kty}/${jwk.crv}`, jwk.kty ?? 'unknown');
}

/**
 * Convert CBOR-encoded COSE_Key to JWK.
 */
export async function toJwk(coseKeyBytes: Uint8Array): Promise<JsonWebKey> {
  const coseKey = decodeCoseKey(coseKeyBytes);
  const kty = coseKey.get(COSE_KEY_KTY);

  // Handle OKP (X25519)
  if (kty === KTY_OKP) {
    const x = coseKey.get(COSE_KEY_X) as Uint8Array;
    const d = coseKey.get(COSE_KEY_D) as Uint8Array | undefined;

    const jwk: JsonWebKey = {
      kty: 'OKP',
      crv: 'X25519',
      x: base64UrlEncode(x),
    };

    if (d) {
      jwk.d = base64UrlEncode(d);
    }

    return jwk;
  }

  // Handle EC2 (P-256)
  if (kty === KTY_EC2) {
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

  throw new InvalidKeyError(`Unsupported key type for JWK: ${kty}`, 'EC2 or OKP');
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
