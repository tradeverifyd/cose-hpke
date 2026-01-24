// HPKE cipher suite configuration with dynamic selection
import {
  CipherSuite,
  KEM_DHKEM_P256_HKDF_SHA256,
  KEM_DHKEM_X25519_HKDF_SHA256,
  KDF_HKDF_SHA256,
  AEAD_AES_256_GCM,
  AEAD_ChaCha20Poly1305,
} from 'hpke';

import {
  type HpkeSuiteId,
  type HpkeSuiteConfig,
  ALG_HPKE_4_INTEGRATED,
  ALG_HPKE_4_KEY_ENCRYPTION,
  ALG_HPKE_7_INTEGRATED,
  ALG_HPKE_7_KEY_ENCRYPTION,
  ALG_A256GCM,
} from '../types/hpke.ts';

import { KTY_EC2, KTY_OKP, CRV_P256, CRV_X25519 } from '../types/cose.ts';

// Default suite
let defaultSuiteId: HpkeSuiteId = 'HPKE-7';

/**
 * Suite configurations for each HPKE suite
 */
const suiteConfigs: Record<HpkeSuiteId, HpkeSuiteConfig> = {
  'HPKE-4': {
    suiteId: 'HPKE-4',
    integratedAlg: ALG_HPKE_4_INTEGRATED,
    keyEncryptionAlg: ALG_HPKE_4_KEY_ENCRYPTION,
    contentAlg: ALG_A256GCM,
    keyType: KTY_OKP,
    curve: CRV_X25519,
  },
  'HPKE-7': {
    suiteId: 'HPKE-7',
    integratedAlg: ALG_HPKE_7_INTEGRATED,
    keyEncryptionAlg: ALG_HPKE_7_KEY_ENCRYPTION,
    contentAlg: ALG_A256GCM,
    keyType: KTY_EC2,
    curve: CRV_P256,
  },
};

/**
 * Get the HPKE cipher suite for a given suite ID.
 *
 * @param suiteId - Suite identifier (default: current default suite)
 * @returns CipherSuite instance
 */
export function getHpkeSuite(suiteId?: HpkeSuiteId): CipherSuite {
  const id = suiteId ?? defaultSuiteId;

  if (id === 'HPKE-4') {
    // HPKE-4: DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, ChaCha20-Poly1305
    return new CipherSuite(
      KEM_DHKEM_X25519_HKDF_SHA256,
      KDF_HKDF_SHA256,
      AEAD_ChaCha20Poly1305
    );
  }

  // HPKE-7: DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM
  return new CipherSuite(
    KEM_DHKEM_P256_HKDF_SHA256,
    KDF_HKDF_SHA256,
    AEAD_AES_256_GCM
  );
}

/**
 * Get the configuration for a given suite ID.
 *
 * @param suiteId - Suite identifier (default: current default suite)
 * @returns Suite configuration
 */
export function getSuiteConfig(suiteId?: HpkeSuiteId): HpkeSuiteConfig {
  return suiteConfigs[suiteId ?? defaultSuiteId];
}

/**
 * Determine the suite ID from an algorithm identifier.
 *
 * @param alg - Algorithm identifier from COSE message
 * @returns Suite ID or null if not recognized
 */
export function getSuiteFromAlg(alg: number): HpkeSuiteId | null {
  if (alg === ALG_HPKE_4_INTEGRATED || alg === ALG_HPKE_4_KEY_ENCRYPTION) {
    return 'HPKE-4';
  }
  if (alg === ALG_HPKE_7_INTEGRATED || alg === ALG_HPKE_7_KEY_ENCRYPTION) {
    return 'HPKE-7';
  }
  return null;
}

/**
 * Set the default HPKE suite for operations.
 *
 * @param suiteId - Suite identifier to use as default
 */
export function setDefaultSuite(suiteId: HpkeSuiteId): void {
  defaultSuiteId = suiteId;
}

/**
 * Get the current default suite ID.
 */
export function getDefaultSuite(): HpkeSuiteId {
  return defaultSuiteId;
}

/**
 * Get the HPKE-7 cipher suite (backward-compatible alias).
 * HPKE-7: DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM
 */
export function getHpke7Suite(): CipherSuite {
  return getHpkeSuite('HPKE-7');
}
