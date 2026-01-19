// HPKE-7 cipher suite configuration
import {
  CipherSuite,
  KEM_DHKEM_P256_HKDF_SHA256,
  KDF_HKDF_SHA256,
  AEAD_AES_256_GCM,
} from 'hpke';

/**
 * Get the HPKE-7 cipher suite.
 * HPKE-7: DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM
 */
export function getHpke7Suite(): CipherSuite {
  return new CipherSuite(
    KEM_DHKEM_P256_HKDF_SHA256,
    KDF_HKDF_SHA256,
    AEAD_AES_256_GCM
  );
}
