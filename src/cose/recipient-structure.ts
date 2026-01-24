// Recipient_structure for HPKE info per draft-ietf-cose-hpke-20
import { encode } from '../util/cbor.ts';

/**
 * Build the Recipient_structure for HPKE info parameter.
 *
 * Per draft-20, the Recipient_structure for HPKE info is:
 *   Recipient_structure = [
 *     context : "HPKE Recipient",
 *     next_layer_alg : int / tstr,
 *     recipient_protected_header : empty_or_serialized_map,
 *     recipient_extra_info : bstr
 *   ]
 *
 * @param nextLayerAlg - Algorithm for the next layer (e.g., ALG_A256GCM = 3)
 * @param recipientProtectedHeader - CBOR-encoded protected header of the recipient
 * @param extraInfo - External extra info (default: empty)
 * @returns CBOR-encoded Recipient_structure
 */
export function buildRecipientStructure(
  nextLayerAlg: number,
  recipientProtectedHeader: Uint8Array,
  extraInfo: Uint8Array = new Uint8Array()
): Uint8Array {
  return encode([
    'HPKE Recipient',
    nextLayerAlg,
    recipientProtectedHeader,
    extraInfo,
  ]);
}
