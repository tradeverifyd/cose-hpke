// COSE_recipient structure handling
import type { HeaderMap } from './headers.ts';

export interface CoseRecipient {
  protectedHeader: Uint8Array;
  unprotectedHeader: HeaderMap;
  ciphertext: Uint8Array;  // Encrypted CEK
}

/**
 * Build a COSE_recipient structure as an array.
 */
export function buildCoseRecipient(data: CoseRecipient): unknown[] {
  return [
    data.protectedHeader,
    data.unprotectedHeader,
    data.ciphertext,
  ];
}

/**
 * Parse a COSE_recipient structure from an array.
 */
export function parseCoseRecipient(arr: unknown[]): CoseRecipient {
  if (arr.length !== 3) {
    throw new Error('COSE_recipient must have 3 elements');
  }

  return {
    protectedHeader: arr[0] as Uint8Array,
    unprotectedHeader: arr[1] as HeaderMap,
    ciphertext: arr[2] as Uint8Array,
  };
}
