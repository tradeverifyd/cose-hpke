import { describe, it, expect } from 'bun:test';
import { decrypt, InvalidKeyError } from '../src/index.ts';
import { encode, Tag } from 'cbor2';

describe('decrypt', () => {
  it('throws on invalid CBOR', async () => {
    const invalidBytes = new Uint8Array([0xff, 0xff]);
    const fakeKey = new Uint8Array([0xa0]); // empty map

    await expect(decrypt(invalidBytes, fakeKey)).rejects.toThrow();
  });

  it('throws on unknown COSE tag', async () => {
    // Create a tagged array with wrong tag
    const badMessage = encode(new Tag(999, [new Uint8Array(), new Map(), new Uint8Array()]));
    const fakeKey = new Uint8Array([0xa0]);

    await expect(decrypt(badMessage, fakeKey)).rejects.toThrow('Unknown COSE tag');
  });

  it('throws on untagged array with wrong length', async () => {
    // Create an array with 2 elements (neither 3 nor 4)
    const badMessage = encode([new Uint8Array(), new Map()]);
    const fakeKey = new Uint8Array([0xa0]);

    await expect(decrypt(badMessage, fakeKey)).rejects.toThrow('Unable to determine COSE message type');
  });

  it('throws on non-array CBOR', async () => {
    // Create a CBOR string (not array or tag)
    const badMessage = encode('not an array');
    const fakeKey = new Uint8Array([0xa0]);

    await expect(decrypt(badMessage, fakeKey)).rejects.toThrow('Unable to determine COSE message type');
  });
});
