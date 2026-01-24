// HPKE algorithm identifiers per draft-ietf-cose-hpke-20

// HPKE-7 Algorithm IDs (P-256 + HKDF-SHA256 + AES-256-GCM)
export const ALG_HPKE_7_INTEGRATED = 45;    // HPKE-7 integrated encryption
export const ALG_HPKE_7_KEY_ENCRYPTION = 53; // HPKE-7 key encryption

// HPKE-4 Algorithm IDs (X25519 + HKDF-SHA256 + ChaCha20-Poly1305)
export const ALG_HPKE_4_INTEGRATED = 42;    // HPKE-4 integrated encryption
export const ALG_HPKE_4_KEY_ENCRYPTION = 50; // HPKE-4 key encryption

// Content encryption algorithm (RFC 9053)
export const ALG_A256GCM = 3;  // A256GCM

// Header parameter labels
export const HEADER_ALG = 1;    // Algorithm identifier
export const HEADER_EK = -4;    // Encapsulated key
export const HEADER_KID = 4;    // Key identifier

// Suite identifier type
export type HpkeSuiteId = 'HPKE-4' | 'HPKE-7';

// Suite configuration interface
export interface HpkeSuiteConfig {
  suiteId: HpkeSuiteId;
  integratedAlg: number;
  keyEncryptionAlg: number;
  contentAlg: number;
  keyType: number;
  curve: number;
}
