// Test vectors verification - run with Node.js via: npx tsx --test test/vectors.test.node.ts
// These tests verify HPKE-4 (X25519) operations using pre-generated test vectors

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { encrypt, decrypt } from '../src/index.ts';
import { decodeCoseKey, toJwk } from '../src/cose/key.ts';

const EXAMPLES_DIR = join(import.meta.dirname, '..', 'examples');

describe('Test vectors (HPKE-4 / X25519)', () => {
  let alicePublicKey: Uint8Array;
  let alicePrivateKey: Uint8Array;
  let ciphertextVector: Uint8Array;

  before(() => {
    // Load test vector keys
    const pubPath = join(EXAMPLES_DIR, 'hpke4_alice_pub.cbor');
    const privPath = join(EXAMPLES_DIR, 'hpke4_alice_full.cbor');
    const ctPath = join(EXAMPLES_DIR, 'ciphertext.cbor');

    assert.ok(existsSync(pubPath), 'Public key file should exist');
    assert.ok(existsSync(privPath), 'Private key file should exist');
    assert.ok(existsSync(ctPath), 'Ciphertext file should exist');

    alicePublicKey = new Uint8Array(readFileSync(pubPath));
    alicePrivateKey = new Uint8Array(readFileSync(privPath));
    ciphertextVector = new Uint8Array(readFileSync(ctPath));
  });

  describe('Ciphertext vector', () => {
    it('decrypts provided ciphertext.cbor test vector', async () => {
      const decrypted = await decrypt(ciphertextVector, alicePrivateKey);
      const plaintext = new TextDecoder().decode(decrypted);

      assert.strictEqual(plaintext, 'hello orie!\n', 'Should decrypt to expected plaintext');
    });
  });

  describe('Key loading', () => {
    it('loads alice public key as OKP/X25519', async () => {
      const coseKey = decodeCoseKey(alicePublicKey);

      // kty = 1 (OKP)
      assert.strictEqual(coseKey.get(1), 1, 'Key type should be OKP (1)');
      // alg = 42 (HPKE-4 integrated)
      assert.strictEqual(coseKey.get(3), 42, 'Algorithm should be HPKE-4 (42)');
      // crv = 4 (X25519)
      assert.strictEqual(coseKey.get(-1), 4, 'Curve should be X25519 (4)');
      // x coordinate should be 32 bytes
      const x = coseKey.get(-2) as Uint8Array;
      assert.strictEqual(x.length, 32, 'X coordinate should be 32 bytes');
    });

    it('loads alice private key with d parameter', async () => {
      const coseKey = decodeCoseKey(alicePrivateKey);

      // Should have all public key fields
      assert.strictEqual(coseKey.get(1), 1, 'Key type should be OKP (1)');
      assert.strictEqual(coseKey.get(-1), 4, 'Curve should be X25519 (4)');

      // Should have private key (d parameter)
      const d = coseKey.get(-4) as Uint8Array;
      assert.ok(d, 'Private key should have d parameter');
      assert.strictEqual(d.length, 32, 'D parameter should be 32 bytes');
    });

    it('converts keys to JWK format', async () => {
      const pubJwk = await toJwk(alicePublicKey);
      assert.strictEqual(pubJwk.kty, 'OKP');
      assert.strictEqual(pubJwk.crv, 'X25519');
      assert.ok(pubJwk.x, 'Public JWK should have x');
      assert.strictEqual(pubJwk.d, undefined, 'Public JWK should not have d');

      const privJwk = await toJwk(alicePrivateKey);
      assert.strictEqual(privJwk.kty, 'OKP');
      assert.strictEqual(privJwk.crv, 'X25519');
      assert.ok(privJwk.x, 'Private JWK should have x');
      assert.ok(privJwk.d, 'Private JWK should have d');
    });

    it('has matching key ID (kid) in both keys', async () => {
      const pubKey = decodeCoseKey(alicePublicKey);
      const privKey = decodeCoseKey(alicePrivateKey);

      const pubKid = pubKey.get(2) as Uint8Array;
      const privKid = privKey.get(2) as Uint8Array;

      assert.ok(pubKid, 'Public key should have kid');
      assert.ok(privKid, 'Private key should have kid');
      assert.deepStrictEqual(pubKid, privKid, 'Key IDs should match');

      // kid should be "alice"
      const kidStr = new TextDecoder().decode(pubKid);
      assert.strictEqual(kidStr, 'alice', 'Key ID should be "alice"');
    });
  });

  describe('Round-trip encryption', () => {
    it('encrypts and decrypts short message', async () => {
      const plaintext = new TextEncoder().encode('Hello, Alice!');

      const ciphertext = await encrypt(plaintext, [alicePublicKey], { suiteId: 'HPKE-4' });
      const decrypted = await decrypt(ciphertext, alicePrivateKey);

      assert.strictEqual(
        new TextDecoder().decode(decrypted),
        'Hello, Alice!',
        'Decrypted message should match original'
      );
    });

    it('encrypts and decrypts empty message', async () => {
      const plaintext = new Uint8Array(0);

      const ciphertext = await encrypt(plaintext, [alicePublicKey], { suiteId: 'HPKE-4' });
      const decrypted = await decrypt(ciphertext, alicePrivateKey);

      assert.strictEqual(decrypted.length, 0, 'Decrypted empty message should be empty');
    });

    it('encrypts and decrypts binary data', async () => {
      const plaintext = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);

      const ciphertext = await encrypt(plaintext, [alicePublicKey], { suiteId: 'HPKE-4' });
      const decrypted = await decrypt(ciphertext, alicePrivateKey);

      assert.deepStrictEqual(decrypted, plaintext, 'Decrypted binary data should match');
    });

    it('encrypts and decrypts large message', async () => {
      // 1KB of data
      const plaintext = new Uint8Array(1024);
      for (let i = 0; i < plaintext.length; i++) {
        plaintext[i] = i % 256;
      }

      const ciphertext = await encrypt(plaintext, [alicePublicKey], { suiteId: 'HPKE-4' });
      const decrypted = await decrypt(ciphertext, alicePrivateKey);

      assert.deepStrictEqual(decrypted, plaintext, 'Decrypted large message should match');
    });
  });

  describe('External AAD', () => {
    it('encrypts and decrypts with external AAD', async () => {
      const plaintext = new TextEncoder().encode('Secret with context');
      const externalAad = new TextEncoder().encode('application-context-v1');

      const ciphertext = await encrypt(plaintext, [alicePublicKey], {
        suiteId: 'HPKE-4',
        externalAad,
      });

      const decrypted = await decrypt(ciphertext, alicePrivateKey, { externalAad });

      assert.strictEqual(
        new TextDecoder().decode(decrypted),
        'Secret with context',
        'Should decrypt with matching AAD'
      );
    });

    it('fails decryption with wrong external AAD', async () => {
      const plaintext = new TextEncoder().encode('Secret with context');
      const externalAad = new TextEncoder().encode('correct-context');
      const wrongAad = new TextEncoder().encode('wrong-context');

      const ciphertext = await encrypt(plaintext, [alicePublicKey], {
        suiteId: 'HPKE-4',
        externalAad,
      });

      await assert.rejects(
        async () => decrypt(ciphertext, alicePrivateKey, { externalAad: wrongAad }),
        /Decryption failed/,
        'Should fail with wrong AAD'
      );
    });

    it('fails decryption when AAD missing', async () => {
      const plaintext = new TextEncoder().encode('Secret with context');
      const externalAad = new TextEncoder().encode('required-context');

      const ciphertext = await encrypt(plaintext, [alicePublicKey], {
        suiteId: 'HPKE-4',
        externalAad,
      });

      await assert.rejects(
        async () => decrypt(ciphertext, alicePrivateKey),
        /Decryption failed/,
        'Should fail without required AAD'
      );
    });
  });

  describe('Error cases', () => {
    it('fails decryption with wrong private key', async () => {
      // Import generateKeyPair dynamically to generate a different key
      const { generateKeyPair } = await import('../src/cose/key.ts');
      const wrongKey = await generateKeyPair('HPKE-4');

      const plaintext = new TextEncoder().encode('Secret message');
      const ciphertext = await encrypt(plaintext, [alicePublicKey], { suiteId: 'HPKE-4' });

      await assert.rejects(
        async () => decrypt(ciphertext, wrongKey.privateKey),
        /Decryption failed/,
        'Should fail with wrong key'
      );
    });

    it('fails with corrupted ciphertext', async () => {
      const plaintext = new TextEncoder().encode('Test message');
      const ciphertext = await encrypt(plaintext, [alicePublicKey], { suiteId: 'HPKE-4' });

      // Corrupt a byte in the middle
      const corrupted = new Uint8Array(ciphertext);
      corrupted[corrupted.length - 10] ^= 0xff;

      await assert.rejects(
        async () => decrypt(corrupted, alicePrivateKey),
        /Decryption failed|invalid/i,
        'Should fail with corrupted ciphertext'
      );
    });
  });
});
