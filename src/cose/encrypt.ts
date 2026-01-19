// COSE_Encrypt structure handling (Tag 96)
import { encode, decode } from '../util/cbor.ts';
import { Tag } from 'cbor2';
import { COSE_ENCRYPT_TAG } from '../types/cose.ts';
import type { HeaderMap } from './headers.ts';
import { type CoseRecipient, parseCoseRecipient, buildCoseRecipient } from './recipient.ts';

export interface CoseEncrypt {
  protectedHeader: Uint8Array;
  unprotectedHeader: HeaderMap;
  ciphertext: Uint8Array;  // Content encrypted with CEK
  recipients: CoseRecipient[];
}

/**
 * Build a COSE_Encrypt message.
 * Returns CBOR-encoded tagged array.
 */
export function buildCoseEncrypt(data: CoseEncrypt): Uint8Array {
  const recipients = data.recipients.map(buildCoseRecipient);

  return encode(new Tag(COSE_ENCRYPT_TAG, [
    data.protectedHeader,
    data.unprotectedHeader,
    data.ciphertext,
    recipients,
  ]));
}

/**
 * Parse a COSE_Encrypt message from CBOR bytes.
 * Accepts both tagged (Tag 96) and untagged arrays.
 */
export function parseCoseEncrypt(bytes: Uint8Array): CoseEncrypt {
  const decoded = decode(bytes);

  let arr: unknown[];
  if (decoded instanceof Tag) {
    if (decoded.tag !== COSE_ENCRYPT_TAG) {
      throw new Error(`Expected COSE_Encrypt tag (96), got ${decoded.tag}`);
    }
    arr = decoded.contents as unknown[];
  } else if (Array.isArray(decoded)) {
    arr = decoded;
  } else {
    throw new Error('Invalid COSE_Encrypt structure');
  }

  if (arr.length !== 4) {
    throw new Error('COSE_Encrypt must have 4 elements');
  }

  const recipientArrays = arr[3] as unknown[][];
  const recipients = recipientArrays.map(parseCoseRecipient);

  return {
    protectedHeader: arr[0] as Uint8Array,
    unprotectedHeader: arr[1] as HeaderMap,
    ciphertext: arr[2] as Uint8Array,
    recipients,
  };
}
