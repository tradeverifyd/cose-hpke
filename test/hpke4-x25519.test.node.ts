// HPKE-4 (X25519) tests - run with Node.js via: npx tsx --test test/hpke4.node.test.ts
// These tests require X25519 support which is available in Node.js but not Bun

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateKeyPair } from '../src/cose/key.ts';
import { encrypt, decrypt } from '../src/index.ts';

describe('HPKE-4 suite (X25519)', () => {
  it('encrypts and decrypts with HPKE-4 (single recipient)', async () => {
    const { publicKey, privateKey } = await generateKeyPair('HPKE-4');
    const plaintext = new TextEncoder().encode('X25519 message');

    const ciphertext = await encrypt(plaintext, [publicKey], { suiteId: 'HPKE-4' });
    const decrypted = await decrypt(ciphertext, privateKey, { suiteId: 'HPKE-4' });

    assert.strictEqual(new TextDecoder().decode(decrypted), 'X25519 message');
  });

  it('encrypts and decrypts with HPKE-4 (multiple recipients)', async () => {
    const recipient1 = await generateKeyPair('HPKE-4');
    const recipient2 = await generateKeyPair('HPKE-4');
    const plaintext = new TextEncoder().encode('Multi-recipient X25519');

    const ciphertext = await encrypt(
      plaintext,
      [recipient1.publicKey, recipient2.publicKey],
      { suiteId: 'HPKE-4' }
    );

    const decrypted1 = await decrypt(ciphertext, recipient1.privateKey);
    const decrypted2 = await decrypt(ciphertext, recipient2.privateKey);

    assert.strictEqual(new TextDecoder().decode(decrypted1), 'Multi-recipient X25519');
    assert.strictEqual(new TextDecoder().decode(decrypted2), 'Multi-recipient X25519');
  });

  it('fails cross-suite decryption (HPKE-4 encrypted, HPKE-7 key)', async () => {
    const hpke4Key = await generateKeyPair('HPKE-4');
    const hpke7Key = await generateKeyPair('HPKE-7');
    const plaintext = new TextEncoder().encode('test');

    const ciphertext = await encrypt(plaintext, [hpke4Key.publicKey], { suiteId: 'HPKE-4' });

    // Should fail with HPKE-7 key
    await assert.rejects(
      async () => decrypt(ciphertext, hpke7Key.privateKey),
      /error|fail|invalid/i
    );
  });
});
