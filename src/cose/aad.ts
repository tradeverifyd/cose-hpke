// Enc_structure for AAD construction per RFC 9052 Section 5.3
import { encode } from '../util/cbor.ts';

/**
 * Build the Enc_structure for authenticated additional data (AAD).
 *
 * Enc_structure = [context, protected, external_aad]
 *
 * @param context - "Encrypt0" for COSE_Encrypt0, "Encrypt" for COSE_Encrypt content,
 *                  "Enc_Recipient" for COSE_Encrypt recipient layer
 * @param protectedHeader - CBOR-encoded protected header
 * @param externalAad - External AAD (default: empty)
 * @returns CBOR-encoded Enc_structure
 */
export function buildEncStructure(
  context: 'Encrypt0' | 'Encrypt' | 'Enc_Recipient',
  protectedHeader: Uint8Array,
  externalAad: Uint8Array = new Uint8Array()
): Uint8Array {
  return encode([context, protectedHeader, externalAad]);
}
