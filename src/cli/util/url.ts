// URL encoding utilities for shareable links

/**
 * Encode bytes to base64url (no padding)
 */
export function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  const base64 = btoa(binary);
  // Convert to base64url: replace + with -, / with _, remove padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode base64url to bytes
 */
export function fromBase64Url(str: string): Uint8Array {
  // Convert from base64url: replace - with +, _ with /
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padLen = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(padLen);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Base URL for shareable links (placeholder, will be configured in Phase 4)
 */
const BASE_URL = 'https://cose-hpke.github.io/decrypt';

/**
 * Create a shareable URL with ciphertext in fragment
 */
export function createShareableUrl(ciphertext: Uint8Array): string {
  const encoded = toBase64Url(ciphertext);
  return `${BASE_URL}#${encoded}`;
}

/**
 * Parse a shareable URL and extract ciphertext from fragment
 * Returns null if URL doesn't have valid fragment
 */
export function parseShareableUrl(url: string): Uint8Array | null {
  try {
    const parsed = new URL(url);
    const fragment = parsed.hash.slice(1); // Remove leading #
    if (!fragment) {
      return null;
    }
    return fromBase64Url(fragment);
  } catch {
    return null;
  }
}

/**
 * Check if input looks like a URL
 */
export function isUrl(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://');
}
