import { describe, it, expect } from 'bun:test';
import { generateKeyPair, encrypt, decrypt, toDiagnostic } from '../src/index.ts';

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
});
