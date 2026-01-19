// COSE type definitions per RFC 9052/9053

// COSE key type values
export const KTY_EC2 = 2;

// COSE curve values
export const CRV_P256 = 1;

// COSE key parameter labels
export const COSE_KEY_KTY = 1;
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
