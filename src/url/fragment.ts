// URL fragment encoding with version prefix and compression support

import { compress, decompress, isCompressionAvailable } from './compress.ts';

// Version byte prefixes for fragment format detection
const VERSION_UNCOMPRESSED = 0x00;
const VERSION_DEFLATE_RAW = 0x01;

/**
 * Encode bytes to base64url (no padding).
 */
export function toBase64Url(bytes: Uint8Array): string {
  // Use Buffer for large arrays to avoid stack overflow with spread operator
  const base64 = Buffer.from(bytes).toString('base64');
  // Convert to base64url: replace + with -, / with _, remove padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode base64url to bytes.
 */
export function fromBase64Url(str: string): Uint8Array {
  // Convert from base64url: replace - with +, _ with /
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padLen = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(padLen);
  // Use Buffer for consistent handling
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Encode data for URL fragment with optional compression.
 * Adds version prefix byte for format detection.
 * Only uses compression if it reduces size.
 */
export async function encodeFragment(data: Uint8Array): Promise<string> {
  if (!isCompressionAvailable()) {
    // Fallback: uncompressed with version prefix
    const payload = new Uint8Array(1 + data.length);
    payload[0] = VERSION_UNCOMPRESSED;
    payload.set(data, 1);
    return toBase64Url(payload);
  }

  const compressed = await compress(data);

  // Only use compression if it reduces size
  if (compressed.length < data.length) {
    const payload = new Uint8Array(1 + compressed.length);
    payload[0] = VERSION_DEFLATE_RAW;
    payload.set(compressed, 1);
    return toBase64Url(payload);
  } else {
    const payload = new Uint8Array(1 + data.length);
    payload[0] = VERSION_UNCOMPRESSED;
    payload.set(data, 1);
    return toBase64Url(payload);
  }
}

/**
 * Decode URL fragment to original data.
 * Handles both versioned (0x00, 0x01) and legacy (no version prefix) formats.
 */
export async function decodeFragment(fragment: string): Promise<Uint8Array> {
  const payload = fromBase64Url(fragment);

  if (payload.length === 0) {
    throw new Error('Empty fragment');
  }

  const version = payload[0];
  const data = payload.slice(1);

  // Check for known version prefixes
  if (version === VERSION_UNCOMPRESSED) {
    return data;
  }

  if (version === VERSION_DEFLATE_RAW) {
    return decompress(data);
  }

  // Legacy format: no version prefix (first byte is not 0x00 or 0x01)
  // Try to decode as raw uncompressed data (the entire payload is the data)
  return payload;
}
