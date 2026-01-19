// COSE-HPKE browser entry point
// Uses browser-compatible base64 encoding (btoa/atob instead of Buffer)

// Core library exports
export {
  generateKeyPair,
  encrypt,
  decrypt,
  encodeCoseKey,
  decodeCoseKey,
  toDiagnostic,
  fromJwk,
  toJwk,
  coseKeyToCryptoKey,
} from './index.ts';

// Types
export type { KeyPair, CoseKeyMap } from './types/cose.ts';

// Errors
export { CoseError, InvalidKeyError, DecryptionError } from './errors.ts';

// Browser-compatible URL transport (override fragment functions with browser versions)
export {
  toBase64Url,
  fromBase64Url,
  encodeFragment,
  decodeFragment,
} from './url/fragment.browser.ts';

// Compression utilities (already browser-compatible via CompressionStream)
export { compress, decompress, isCompressionAvailable } from './url/compress.ts';

/**
 * Maximum URL length (Chrome limit: 2MB)
 */
export const MAX_URL_LENGTH = 2 * 1024 * 1024;

/**
 * Default base URL for shareable links
 */
export const BASE_URL = 'https://cose-hpke.github.io/decrypt';

/**
 * Error thrown when URL exceeds maximum length
 */
export class UrlTooLargeError extends Error {
  public readonly actualSize: number;
  public readonly maxSize: number;

  constructor(actualSize: number, maxSize: number) {
    const actualMB = (actualSize / (1024 * 1024)).toFixed(2);
    const maxMB = (maxSize / (1024 * 1024)).toFixed(2);
    super(`URL exceeds maximum length: ${actualMB}MB > ${maxMB}MB limit`);
    this.name = 'UrlTooLargeError';
    this.actualSize = actualSize;
    this.maxSize = maxSize;
  }
}

/**
 * Create a shareable URL with ciphertext in fragment.
 * Compresses data if beneficial.
 * Uses browser-compatible base64 encoding.
 *
 * @param ciphertext - The encrypted COSE message bytes
 * @param baseUrl - Optional base URL (defaults to https://cose-hpke.github.io/decrypt)
 * @returns Shareable URL with encrypted data in fragment
 * @throws UrlTooLargeError if URL exceeds 2MB
 */
export async function createShareableUrl(
  ciphertext: Uint8Array,
  baseUrl: string = BASE_URL
): Promise<string> {
  const { encodeFragment } = await import('./url/fragment.browser.ts');
  const fragment = await encodeFragment(ciphertext);
  const url = `${baseUrl}#${fragment}`;

  if (url.length > MAX_URL_LENGTH) {
    throw new UrlTooLargeError(url.length, MAX_URL_LENGTH);
  }

  return url;
}

/**
 * Parse a shareable URL and extract ciphertext from fragment.
 * Handles both versioned (compressed) and legacy (uncompressed) formats.
 * Uses browser-compatible base64 decoding.
 *
 * @param url - The shareable URL to parse
 * @returns The decrypted COSE message bytes
 * @throws Error if URL has no fragment
 */
export async function parseShareableUrl(url: string): Promise<Uint8Array> {
  const { decodeFragment } = await import('./url/fragment.browser.ts');
  const parsed = new URL(url);
  const fragment = parsed.hash.slice(1); // Remove leading #

  if (!fragment) {
    throw new Error('URL has no fragment');
  }

  return decodeFragment(fragment);
}
