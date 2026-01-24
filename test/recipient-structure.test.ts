import { describe, it, expect } from 'bun:test';
import { buildRecipientStructure } from '../src/cose/recipient-structure.ts';
import { decode } from '../src/util/cbor.ts';
import { ALG_A256GCM } from '../src/types/hpke.ts';
import { buildProtectedHeader } from '../src/cose/headers.ts';

describe('Recipient_structure', () => {
  it('builds correct structure per draft-20', () => {
    const recipientProtectedHeader = buildProtectedHeader(53); // HPKE-7 key encryption
    const structure = buildRecipientStructure(
      ALG_A256GCM,
      recipientProtectedHeader
    );

    const decoded = decode(structure) as unknown[];
    expect(decoded).toBeInstanceOf(Array);
    expect(decoded.length).toBe(4);

    // context = "HPKE Recipient"
    expect(decoded[0]).toBe('HPKE Recipient');

    // next_layer_alg = 3 (A256GCM)
    expect(decoded[1]).toBe(3);

    // recipient_protected_header = serialized map
    expect(decoded[2]).toBeInstanceOf(Uint8Array);

    // recipient_extra_info = empty bstr (default)
    expect(decoded[3]).toBeInstanceOf(Uint8Array);
    expect((decoded[3] as Uint8Array).length).toBe(0);
  });

  it('includes extra info when provided', () => {
    const recipientProtectedHeader = buildProtectedHeader(53);
    const extraInfo = new TextEncoder().encode('extra context');
    const structure = buildRecipientStructure(
      ALG_A256GCM,
      recipientProtectedHeader,
      extraInfo
    );

    const decoded = decode(structure) as unknown[];
    expect(decoded[3]).toEqual(extraInfo);
  });

  it('encodes as valid CBOR array', () => {
    const recipientProtectedHeader = buildProtectedHeader(50); // HPKE-4 key encryption
    const structure = buildRecipientStructure(
      ALG_A256GCM,
      recipientProtectedHeader
    );

    // Should not throw
    const decoded = decode(structure);
    expect(decoded).toBeDefined();
  });
});
