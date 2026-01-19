// COSE header handling for protected and unprotected headers
import { encode, decode } from '../util/cbor.ts';
import { HEADER_ALG, HEADER_EK } from '../types/hpke.ts';

export type HeaderMap = Map<number, unknown>;

/**
 * Build a protected header with algorithm identifier.
 * Returns CBOR-encoded header map.
 */
export function buildProtectedHeader(alg: number): Uint8Array {
  const header = new Map<number, number>();
  header.set(HEADER_ALG, alg);
  return encode(header);
}

/**
 * Parse a protected header from CBOR bytes.
 */
export function parseProtectedHeader(bytes: Uint8Array): HeaderMap {
  if (bytes.length === 0) {
    return new Map();
  }
  return decode(bytes) as HeaderMap;
}

/**
 * Build an unprotected header with encapsulated key.
 */
export function buildUnprotectedHeader(ek: Uint8Array): HeaderMap {
  const header = new Map<number, Uint8Array>();
  header.set(HEADER_EK, ek);
  return header;
}
