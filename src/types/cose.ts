// COSE type definitions per RFC 9052/9053

// COSE key type values
export const KTY_OKP = 1;  // Octet Key Pair (e.g., X25519, Ed25519)
export const KTY_EC2 = 2;  // EC2 (e.g., P-256)

// COSE curve values
export const CRV_P256 = 1;    // EC2: P-256
export const CRV_X25519 = 4;  // OKP: X25519

// COSE key parameter labels
export const COSE_KEY_KTY = 1;
export const COSE_KEY_ALG = 3;
export const COSE_KEY_CRV = -1;
export const COSE_KEY_X = -2;
export const COSE_KEY_Y = -3;
export const COSE_KEY_D = -4;

// COSE structure tags
export const COSE_ENCRYPT0_TAG = 16;
export const COSE_ENCRYPT_TAG = 96;

// Type for decoded COSE_Key map
export type CoseKeyMap = Map<number, number | Uint8Array>;

// Keypair with CBOR-encoded COSE_Key values
export interface KeyPair {
  publicKey: Uint8Array;   // CBOR-encoded COSE_Key
  privateKey: Uint8Array;  // CBOR-encoded COSE_Key with 'd' parameter
}
