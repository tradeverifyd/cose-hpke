// URL encoding utilities for shareable links
// Delegates to library implementation with compression support

export {
  createShareableUrl,
  parseShareableUrl,
  toBase64Url,
  fromBase64Url,
  UrlTooLargeError,
} from '../../url/index.ts';

/**
 * Check if input looks like a URL
 */
export function isUrl(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://');
}
