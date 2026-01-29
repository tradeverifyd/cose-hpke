// COSE_Encrypt0 structure handling (Tag 16)
import { encode, decode } from '../util/cbor.ts';
import { Tag } from 'cbor2';
import { COSE_ENCRYPT0_TAG } from '../types/cose.ts';
import type { HeaderMap } from './headers.ts';

export interface CoseEncrypt0 {
  protectedHeader: Uint8Array;
  unprotectedHeader: HeaderMap;
  ciphertext: Uint8Array;
}

/**
 * Build a COSE_Encrypt0 message.
 * Returns CBOR-encoded tagged array.
 */
export function buildCoseEncrypt0(data: CoseEncrypt0): Uint8Array {
  return encode(new Tag(COSE_ENCRYPT0_TAG, [
    data.protectedHeader,
    data.unprotectedHeader,
    data.ciphertext,
  ]));
}

/**
 * Parse a COSE_Encrypt0 message from CBOR bytes.
 * Accepts both tagged (Tag 16) and untagged arrays.
 */
export function parseCoseEncrypt0(bytes: Uint8Array): CoseEncrypt0 {
  const decoded = decode(bytes);

  // Handle tagged or untagged input
  let arr: unknown[];
  if (decoded instanceof Tag) {
    if (decoded.tag !== COSE_ENCRYPT0_TAG) {
      throw new Error(`Expected COSE_Encrypt0 tag (16), got ${decoded.tag}`);
    }
    arr = decoded.contents as unknown[];
  } else if (Array.isArray(decoded)) {
    arr = decoded;
  } else {
    throw new Error('Invalid COSE_Encrypt0 structure');
  }

  if (arr.length !== 3) {
    throw new Error('COSE_Encrypt0 must have 3 elements');
  }

  // Ensure we have plain Uint8Array, not Buffer (cbor2 returns Buffer in Node.js)
  // Buffer is a Uint8Array subclass but cbor2 encodes it differently, so we must convert
  const toUint8Array = (data: unknown): Uint8Array => {
    if (data instanceof Uint8Array) return new Uint8Array(data);
    throw new Error('Expected byte string');
  };

  return {
    protectedHeader: toUint8Array(arr[0]),
    unprotectedHeader: arr[1] as HeaderMap,
    ciphertext: toUint8Array(arr[2]),
  };
}
