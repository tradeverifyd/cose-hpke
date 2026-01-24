import { describe, it, expect } from 'bun:test';
import { generateKeyPair, encrypt, decrypt, HEADER_ALG, ALG_A256GCM } from '../src/index.ts';
import { decode } from '../src/util/cbor.ts';
import { Tag } from 'cbor2';
import { parseProtectedHeader } from '../src/cose/headers.ts';

describe('encrypt', () => {
  describe('single recipient (integrated encryption)', () => {
    it('encrypts and decrypts successfully', async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      const plaintext = new TextEncoder().encode('Hello, COSE-HPKE!');

      const ciphertext = await encrypt(plaintext, [publicKey]);
      expect(ciphertext).toBeInstanceOf(Uint8Array);

      const decrypted = await decrypt(ciphertext, privateKey);
      expect(new TextDecoder().decode(decrypted)).toBe('Hello, COSE-HPKE!');
    });

    it('produces COSE_Encrypt0 (tag 16)', async () => {
      const { publicKey } = await generateKeyPair();
      const plaintext = new TextEncoder().encode('test');

      const ciphertext = await encrypt(plaintext, [publicKey]);

      // CBOR tag 16 is encoded as d0 10, but cbor2 uses compact encoding
      // Tag 16 = 0xd0 (small tag marker for tag 0-23)
      expect(ciphertext[0]).toBe(0xd0);
    });

    it('fails with wrong private key', async () => {
      const sender = await generateKeyPair();
      const wrongRecipient = await generateKeyPair();
      const plaintext = new TextEncoder().encode('secret');

      const ciphertext = await encrypt(plaintext, [sender.publicKey]);

      await expect(decrypt(ciphertext, wrongRecipient.privateKey)).rejects.toThrow();
    });
  });

  describe('multiple recipients (key encryption)', () => {
    it('encrypts to multiple recipients', async () => {
      const recipient1 = await generateKeyPair();
      const recipient2 = await generateKeyPair();
      const plaintext = new TextEncoder().encode('Multi-recipient message');

      const ciphertext = await encrypt(plaintext, [
        recipient1.publicKey,
        recipient2.publicKey,
      ]);

      // Both recipients can decrypt
      const decrypted1 = await decrypt(ciphertext, recipient1.privateKey);
      const decrypted2 = await decrypt(ciphertext, recipient2.privateKey);

      expect(new TextDecoder().decode(decrypted1)).toBe('Multi-recipient message');
      expect(new TextDecoder().decode(decrypted2)).toBe('Multi-recipient message');
    });

    it('produces COSE_Encrypt (tag 96)', async () => {
      const recipient1 = await generateKeyPair();
      const recipient2 = await generateKeyPair();
      const plaintext = new TextEncoder().encode('test');

      const ciphertext = await encrypt(plaintext, [
        recipient1.publicKey,
        recipient2.publicKey,
      ]);

      // Tag 96 encoded as d8 60
      expect(ciphertext[0]).toBe(0xd8);
      expect(ciphertext[1]).toBe(0x60);
    });

    it('only the correct recipients can decrypt', async () => {
      const recipient1 = await generateKeyPair();
      const recipient2 = await generateKeyPair();
      const outsider = await generateKeyPair();
      const plaintext = new TextEncoder().encode('Private message');

      const ciphertext = await encrypt(plaintext, [
        recipient1.publicKey,
        recipient2.publicKey,
      ]);

      // Outsider cannot decrypt
      await expect(decrypt(ciphertext, outsider.privateKey)).rejects.toThrow('No matching recipient');
    });

    it('includes content alg in protected header', async () => {
      const recipient1 = await generateKeyPair();
      const recipient2 = await generateKeyPair();
      const plaintext = new TextEncoder().encode('test');

      const ciphertext = await encrypt(plaintext, [
        recipient1.publicKey,
        recipient2.publicKey,
      ]);

      // Parse the COSE_Encrypt structure
      const decoded = decode(ciphertext) as Tag;
      const [protectedHeaderBytes] = decoded.contents as [Uint8Array, unknown, unknown, unknown];
      const protectedHeader = parseProtectedHeader(protectedHeaderBytes);

      // Content protected header should have alg: 3 (A256GCM)
      expect(protectedHeader.get(HEADER_ALG)).toBe(ALG_A256GCM);
    });
  });

  describe('edge cases', () => {
    it('throws on empty recipients array', async () => {
      const plaintext = new TextEncoder().encode('test');
      await expect(encrypt(plaintext, [])).rejects.toThrow('At least one recipient');
    });

    it('handles empty plaintext', async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      const plaintext = new Uint8Array(0);

      const ciphertext = await encrypt(plaintext, [publicKey]);
      const decrypted = await decrypt(ciphertext, privateKey);

      expect(decrypted.length).toBe(0);
    });

    it('handles large plaintext', async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      const plaintext = new Uint8Array(10000).fill(0x42);

      const ciphertext = await encrypt(plaintext, [publicKey]);
      const decrypted = await decrypt(ciphertext, privateKey);

      expect(decrypted).toEqual(plaintext);
    });
  });

  // X25519 (HPKE-4) is not supported in all WebCrypto runtimes (e.g., Bun)
  // These tests are skipped when X25519 is unavailable
  describe.skip('HPKE-4 suite (X25519)', () => {
    it('encrypts and decrypts with HPKE-4 (single recipient)', async () => {
      const { publicKey, privateKey } = await generateKeyPair('HPKE-4');
      const plaintext = new TextEncoder().encode('X25519 message');

      const ciphertext = await encrypt(plaintext, [publicKey], { suiteId: 'HPKE-4' });
      const decrypted = await decrypt(ciphertext, privateKey, { suiteId: 'HPKE-4' });

      expect(new TextDecoder().decode(decrypted)).toBe('X25519 message');
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

      expect(new TextDecoder().decode(decrypted1)).toBe('Multi-recipient X25519');
      expect(new TextDecoder().decode(decrypted2)).toBe('Multi-recipient X25519');
    });

    it('fails cross-suite decryption (HPKE-4 encrypted, HPKE-7 key)', async () => {
      const hpke4Key = await generateKeyPair('HPKE-4');
      const hpke7Key = await generateKeyPair('HPKE-7');
      const plaintext = new TextEncoder().encode('test');

      const ciphertext = await encrypt(plaintext, [hpke4Key.publicKey], { suiteId: 'HPKE-4' });

      // Should fail with HPKE-7 key
      await expect(decrypt(ciphertext, hpke7Key.privateKey)).rejects.toThrow();
    });
  });

  describe('external AAD', () => {
    it('encrypts and decrypts with matching external AAD', async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      const plaintext = new TextEncoder().encode('AAD protected message');
      const externalAad = new TextEncoder().encode('context data');

      const ciphertext = await encrypt(plaintext, [publicKey], { externalAad });
      const decrypted = await decrypt(ciphertext, privateKey, { externalAad });

      expect(new TextDecoder().decode(decrypted)).toBe('AAD protected message');
    });

    it('fails with mismatched external AAD', async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      const plaintext = new TextEncoder().encode('AAD protected');
      const encryptAad = new TextEncoder().encode('correct');
      const decryptAad = new TextEncoder().encode('wrong');

      const ciphertext = await encrypt(plaintext, [publicKey], { externalAad: encryptAad });

      await expect(decrypt(ciphertext, privateKey, { externalAad: decryptAad })).rejects.toThrow();
    });

    it('fails when AAD provided on decrypt but not encrypt', async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      const plaintext = new TextEncoder().encode('No AAD');

      const ciphertext = await encrypt(plaintext, [publicKey]);
      const extraAad = new TextEncoder().encode('unexpected');

      await expect(decrypt(ciphertext, privateKey, { externalAad: extraAad })).rejects.toThrow();
    });
  });

  describe('external info (integrated encryption)', () => {
    it('encrypts and decrypts with matching external info', async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      const plaintext = new TextEncoder().encode('Info protected message');
      const externalInfo = new TextEncoder().encode('app specific info');

      const ciphertext = await encrypt(plaintext, [publicKey], { externalInfo });
      const decrypted = await decrypt(ciphertext, privateKey, { externalInfo });

      expect(new TextDecoder().decode(decrypted)).toBe('Info protected message');
    });

    it('fails with mismatched external info', async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      const plaintext = new TextEncoder().encode('Info protected');
      const encryptInfo = new TextEncoder().encode('correct');
      const decryptInfo = new TextEncoder().encode('wrong');

      const ciphertext = await encrypt(plaintext, [publicKey], { externalInfo: encryptInfo });

      await expect(decrypt(ciphertext, privateKey, { externalInfo: decryptInfo })).rejects.toThrow();
    });
  });

  describe('recipient extra info (key encryption)', () => {
    it('encrypts and decrypts with matching recipient extra info', async () => {
      const recipient1 = await generateKeyPair();
      const recipient2 = await generateKeyPair();
      const plaintext = new TextEncoder().encode('Extra info message');
      const recipientExtraInfo = new TextEncoder().encode('recipient context');

      const ciphertext = await encrypt(
        plaintext,
        [recipient1.publicKey, recipient2.publicKey],
        { recipientExtraInfo }
      );
      const decrypted = await decrypt(ciphertext, recipient1.privateKey, { recipientExtraInfo });

      expect(new TextDecoder().decode(decrypted)).toBe('Extra info message');
    });

    it('fails with mismatched recipient extra info', async () => {
      const recipient1 = await generateKeyPair();
      const recipient2 = await generateKeyPair();
      const plaintext = new TextEncoder().encode('Extra info');
      const encryptInfo = new TextEncoder().encode('correct');
      const decryptInfo = new TextEncoder().encode('wrong');

      const ciphertext = await encrypt(
        plaintext,
        [recipient1.publicKey, recipient2.publicKey],
        { recipientExtraInfo: encryptInfo }
      );

      await expect(
        decrypt(ciphertext, recipient1.privateKey, { recipientExtraInfo: decryptInfo })
      ).rejects.toThrow();
    });
  });
});
