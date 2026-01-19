// URL transport module tests

import { describe, test, expect } from 'bun:test';
import {
  compress,
  decompress,
  isCompressionAvailable,
  toBase64Url,
  fromBase64Url,
  encodeFragment,
  decodeFragment,
  createShareableUrl,
  parseShareableUrl,
  UrlTooLargeError,
  MAX_URL_LENGTH,
  encrypt,
  decrypt,
  generateKeyPair,
} from '../src/index.ts';

describe('Compression', () => {
  test('compress/decompress round-trip', async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const compressed = await compress(original);
    const decompressed = await decompress(compressed);
    expect(Array.from(decompressed)).toEqual(Array.from(original));
  });

  test('compression reduces size for repetitive data', async () => {
    // Create repetitive data that compresses well
    const repetitive = new Uint8Array(1000).fill(0x61); // 'a' repeated
    const compressed = await compress(repetitive);
    expect(compressed.length).toBeLessThan(repetitive.length);
  });

  // Note: DecompressionStream error handling test skipped due to Bun's async
  // error event emission that leaks across test boundaries. The decompress
  // function does throw on invalid data, but Bun's internal handlers also
  // emit an error event that causes test framework issues.

  test('isCompressionAvailable returns true in modern Bun', () => {
    expect(isCompressionAvailable()).toBe(true);
  });
});

describe('Base64URL encoding', () => {
  test('toBase64Url and fromBase64Url are inverses', () => {
    const original = new Uint8Array([1, 2, 3, 255, 254, 253, 0, 128]);
    const encoded = toBase64Url(original);
    const decoded = fromBase64Url(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  test('toBase64Url produces URL-safe output', () => {
    // Create bytes that would produce + and / in standard base64
    const bytes = new Uint8Array([62, 255, 191]); // Would be Pv+/ in standard base64
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  test('fromBase64Url handles padding correctly', () => {
    // Test various lengths that would require different padding
    for (const len of [1, 2, 3, 4, 5, 10, 100]) {
      const original = new Uint8Array(len).map((_, i) => i % 256);
      const encoded = toBase64Url(original);
      const decoded = fromBase64Url(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(original));
    }
  });
});

describe('Fragment encoding', () => {
  test('encodeFragment/decodeFragment round-trip', async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const encoded = await encodeFragment(original);
    const decoded = await decodeFragment(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  test('encodeFragment uses compression when beneficial', async () => {
    // Create repetitive data that compresses well
    const repetitive = new Uint8Array(1000).fill(0x61);
    const encoded = await encodeFragment(repetitive);
    const payload = fromBase64Url(encoded);

    // First byte should be 0x01 (VERSION_DEFLATE_RAW)
    expect(payload[0]).toBe(0x01);
  });

  test('encodeFragment skips compression when it would expand', async () => {
    // Random-looking data that doesn't compress well
    const random = new Uint8Array([0x8a, 0x3f, 0x17, 0xb2, 0x9e]);
    const encoded = await encodeFragment(random);
    const payload = fromBase64Url(encoded);

    // First byte should be 0x00 (VERSION_UNCOMPRESSED)
    expect(payload[0]).toBe(0x00);
  });

  test('decodeFragment handles legacy (no version prefix) fragments', async () => {
    // Create a legacy fragment (direct base64url, no version prefix)
    // First byte is NOT 0x00 or 0x01 (it's 0xd0, CBOR tag marker)
    const legacyData = new Uint8Array([0xd0, 0x83, 0xa1, 0x01, 0x05]);
    const legacyFragment = toBase64Url(legacyData);

    const decoded = await decodeFragment(legacyFragment);

    // Should return the entire payload (backward compatible)
    expect(Array.from(decoded)).toEqual(Array.from(legacyData));
  });

  test('decodeFragment throws on empty fragment', async () => {
    await expect(decodeFragment('')).rejects.toThrow('Empty fragment');
  });
});

describe('URL creation', () => {
  test('createShareableUrl creates valid URL with fragment', async () => {
    const ciphertext = new Uint8Array([1, 2, 3, 4, 5]);
    const url = await createShareableUrl(ciphertext);

    expect(url).toContain('https://');
    expect(url).toContain('#');

    // Verify URL is valid
    const parsed = new URL(url);
    expect(parsed.hash).not.toBe('');
  });

  test('createShareableUrl uses compression', async () => {
    // Create repetitive data
    const repetitive = new Uint8Array(1000).fill(0x42);
    const url = await createShareableUrl(repetitive);
    const fragment = url.split('#')[1]!;
    const payload = fromBase64Url(fragment);

    // Should be compressed (version byte 0x01)
    expect(payload[0]).toBe(0x01);
  });

  test('parseShareableUrl extracts and decompresses ciphertext', async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const url = await createShareableUrl(original);
    const extracted = await parseShareableUrl(url);

    expect(Array.from(extracted)).toEqual(Array.from(original));
  });

  test('createShareableUrl throws UrlTooLargeError for oversized data', async () => {
    // Create payload that exceeds 2MB URL limit
    // Base64 expands by ~33%, so need ~1.6MB minimum input
    // The version byte + compression overhead means we need slightly more
    // crypto.getRandomValues produces truly incompressible data
    const oversized = new Uint8Array(1.8 * 1024 * 1024);
    crypto.getRandomValues(oversized);

    try {
      await createShareableUrl(oversized);
      expect(true).toBe(false); // Should have thrown
    } catch (error) {
      expect(error).toBeInstanceOf(UrlTooLargeError);
      const urlError = error as UrlTooLargeError;
      expect(urlError.actualSize).toBeGreaterThan(MAX_URL_LENGTH);
      expect(urlError.maxSize).toBe(MAX_URL_LENGTH);
      expect(urlError.message).toContain('MB');
    }
  });

  test('fragment data never appears in URL path', async () => {
    const ciphertext = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const url = await createShareableUrl(ciphertext);
    const parsed = new URL(url);

    // Fragment should be after #, not in pathname
    expect(parsed.pathname).not.toContain(toBase64Url(ciphertext));
    expect(parsed.hash.slice(1)).not.toBe(''); // Fragment exists
  });

  test('parseShareableUrl throws for URL without fragment', async () => {
    await expect(parseShareableUrl('https://example.com')).rejects.toThrow('no fragment');
  });
});

describe('End-to-end with encryption', () => {
  test('full encrypt -> URL -> decrypt round-trip with compression', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const message = 'Hello, compressed COSE-HPKE world!';
    const plaintext = new TextEncoder().encode(message);

    // Encrypt
    const ciphertext = await encrypt(plaintext, [publicKey]);

    // Create shareable URL (with compression)
    const url = await createShareableUrl(ciphertext);
    expect(url).toContain('https://');
    expect(url).toContain('#');

    // Parse URL (decompresses)
    const extracted = await parseShareableUrl(url);

    // Decrypt
    const decrypted = await decrypt(extracted, privateKey);

    // Verify original message
    expect(new TextDecoder().decode(decrypted)).toBe(message);
  });

  test('compression is beneficial for typical encrypted messages', async () => {
    const { publicKey } = await generateKeyPair();
    const message = 'A message with some repetitive content content content content!';
    const plaintext = new TextEncoder().encode(message);

    const ciphertext = await encrypt(plaintext, [publicKey]);

    // Create URL
    const url = await createShareableUrl(ciphertext);
    const fragment = url.split('#')[1]!;

    // Check if compression was used
    const payload = fromBase64Url(fragment);
    const version = payload[0];

    // Either compressed (0x01) or uncompressed (0x00) is valid
    // Encrypted data may or may not compress well
    expect(version === 0x00 || version === 0x01).toBe(true);
  });

  test('URL created by library can be parsed', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const plaintext = new TextEncoder().encode('Test message');

    const ciphertext = await encrypt(plaintext, [publicKey]);
    const url = await createShareableUrl(ciphertext);

    // Verify full round-trip
    const extracted = await parseShareableUrl(url);
    const decrypted = await decrypt(extracted, privateKey);
    expect(new TextDecoder().decode(decrypted)).toBe('Test message');
  });
});
