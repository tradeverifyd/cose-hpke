# Phase 3: URL Transport - Research

**Researched:** 2026-01-19
**Domain:** Compression Streams API, URL Fragment Transport, Base64URL Encoding
**Confidence:** HIGH

## Summary

This phase adds compression to the URL transport layer. The existing codebase already has base64url encoding and URL creation utilities in `src/cli/util/url.ts`. The task is to integrate CompressionStream for compression before encoding.

CompressionStream is a standard Web API now available in all major browsers (since May 2023) and Bun (since v1.3.3, December 2025). The project uses Bun 1.3.6, which fully supports CompressionStream with `deflate-raw`, `deflate`, `gzip`, and even extended formats like `brotli` and `zstd`.

The recommended approach is to use `deflate-raw` for minimal overhead (no headers/checksums), compress before base64url encoding, and decompress after decoding. Feature detection enables graceful fallback to uncompressed data for edge cases.

**Primary recommendation:** Use `deflate-raw` compression via CompressionStream with a version prefix byte to distinguish compressed vs uncompressed fragments.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CompressionStream | Web API | Stream compression | Native, no dependencies, supported everywhere |
| DecompressionStream | Web API | Stream decompression | Paired with CompressionStream |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Bun.gzipSync | Built-in | Sync gzip compression | Not needed - CompressionStream preferred |
| pako | npm | Compression polyfill | Only if targeting very old environments |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| deflate-raw | gzip | gzip adds 10-11 bytes overhead (headers + checksum) |
| CompressionStream | Bun.gzipSync | Sync API blocks, streams are more flexible |
| CompressionStream | pako/fflate | Adds dependency, larger bundle |

**Installation:**
```bash
# No additional packages needed - CompressionStream is native
```

## Architecture Patterns

### Recommended Project Structure

The compression utilities should be added as a library module (not CLI-only) since the web demo will also need them:

```
src/
├── url/                    # NEW: URL transport module
│   ├── compress.ts         # Compression/decompression helpers
│   ├── fragment.ts         # URL fragment encoding (moved/refactored from CLI)
│   └── index.ts            # Public API
├── cli/
│   └── util/
│       └── url.ts          # Keep for CLI-specific URL utilities, import from src/url
└── index.ts                # Export url module
```

### Pattern 1: Async Compression Helper

**What:** Wrap CompressionStream in async function returning Uint8Array
**When to use:** All compression operations
**Example:**
```typescript
// Source: MDN CompressionStream + verified pattern
async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
```

### Pattern 2: Version Prefix for Fragment Format

**What:** Prepend a version byte to distinguish format versions
**When to use:** URL fragment encoding to enable future format changes
**Example:**
```typescript
// Version byte prefixes:
// 0x00 = uncompressed (fallback/legacy)
// 0x01 = deflate-raw compressed

const VERSION_UNCOMPRESSED = 0x00;
const VERSION_DEFLATE_RAW = 0x01;

async function encodeFragment(data: Uint8Array): Promise<string> {
  const compressed = await compress(data);

  // Only use compression if it actually reduces size
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

async function decodeFragment(fragment: string): Promise<Uint8Array> {
  const payload = fromBase64Url(fragment);
  const version = payload[0];
  const data = payload.slice(1);

  if (version === VERSION_DEFLATE_RAW) {
    return decompress(data);
  } else if (version === VERSION_UNCOMPRESSED) {
    return data;
  } else {
    throw new Error(`Unknown fragment version: ${version}`);
  }
}
```

### Pattern 3: Size Validation

**What:** Check total URL length against browser limits before returning
**When to use:** createShareableUrl function
**Example:**
```typescript
const MAX_URL_LENGTH = 2 * 1024 * 1024; // 2MB Chrome limit

function createShareableUrl(ciphertext: Uint8Array, baseUrl: string): string {
  const fragment = encodeFragment(ciphertext);
  const url = `${baseUrl}#${fragment}`;

  if (url.length > MAX_URL_LENGTH) {
    const sizeMB = (url.length / (1024 * 1024)).toFixed(2);
    throw new Error(
      `URL exceeds maximum length: ${sizeMB}MB > 2MB limit. ` +
      `Use --output flag to save to file instead.`
    );
  }

  return url;
}
```

### Anti-Patterns to Avoid

- **Using gzip for URL fragments:** Adds unnecessary header overhead (10-11 bytes). Use `deflate-raw` instead.
- **Compressing without checking size benefit:** Small data may expand after compression. Always compare sizes.
- **Blocking compression:** Use async CompressionStream, not sync alternatives.
- **Missing version prefix:** Makes future format changes impossible without breaking existing URLs.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compression | Custom deflate | CompressionStream | Native, optimized, correct |
| Base64URL | Manual bit manipulation | Existing toBase64Url/fromBase64Url | Already implemented and tested |
| Stream concatenation | Manual chunk collection | new Response(stream).arrayBuffer() | Simpler, handles edge cases |

**Key insight:** The existing `src/cli/util/url.ts` already has correct base64url implementation. Don't rewrite it - refactor to share between CLI and library.

## Common Pitfalls

### Pitfall 1: Compression Expanding Small Data
**What goes wrong:** Compressed output larger than input for small messages
**Why it happens:** Compression metadata and dictionary overhead
**How to avoid:** Compare compressed vs original size, use uncompressed if larger
**Warning signs:** Fragment longer than expected for short messages

### Pitfall 2: Forgetting Async Nature
**What goes wrong:** Calling compress/decompress without await
**Why it happens:** CompressionStream is always async
**How to avoid:** Functions must be async, all calls must await
**Warning signs:** Getting Promise objects instead of Uint8Array

### Pitfall 3: DecompressionStream TypeError on Invalid Data
**What goes wrong:** Uncaught TypeError when decompressing corrupted/invalid data
**Why it happens:** DecompressionStream throws on malformed input
**How to avoid:** Wrap decompress in try-catch, provide clear error message
**Warning signs:** Unhandled promise rejections

### Pitfall 4: Safari for-await Incompatibility
**What goes wrong:** `for await (chunk of stream)` fails in Safari
**Why it happens:** Safari doesn't support async iteration on ReadableStream
**How to avoid:** Use `new Response(stream).arrayBuffer()` pattern instead
**Warning signs:** Works in Chrome/Bun, fails in Safari

### Pitfall 5: URL Length Varies by Browser
**What goes wrong:** URL works in Chrome but fails in Safari/Edge
**Why it happens:** Different browsers have different URL length limits
**How to avoid:** Use conservative 2MB limit (Chrome's limit), test in multiple browsers
**Warning signs:** URLs working locally but failing for users

| Browser | Max URL Length |
|---------|---------------|
| Chrome | 2MB (2,097,152 chars) |
| Firefox | Unlimited (but address bar stops at ~65,536) |
| Safari | ~80,000 chars |
| Edge | ~2083 chars total, ~2048 in path |

**Note:** Fragments are NOT sent to server, so server limits don't apply. But browser limits still do.

## Code Examples

Verified patterns from official sources:

### Complete Compression Module
```typescript
// src/url/compress.ts
// Source: MDN CompressionStream API, Chrome DevRel blog

/**
 * Compress data using deflate-raw algorithm.
 * Returns compressed Uint8Array.
 */
export async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

/**
 * Decompress deflate-raw compressed data.
 * Throws if data is corrupted or not valid deflate-raw.
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  } catch (error) {
    throw new Error('Failed to decompress data: invalid or corrupted');
  }
}

/**
 * Check if CompressionStream is available.
 * Should always be true in modern Bun and browsers.
 */
export function isCompressionAvailable(): boolean {
  return typeof CompressionStream !== 'undefined';
}
```

### Complete Fragment Encoding Module
```typescript
// src/url/fragment.ts
// Source: Existing url.ts patterns + compression integration

import { compress, decompress, isCompressionAvailable } from './compress.ts';

const VERSION_UNCOMPRESSED = 0x00;
const VERSION_DEFLATE_RAW = 0x01;

/**
 * Encode bytes to base64url (no padding).
 * Moved from cli/util/url.ts for shared use.
 */
export function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode base64url to bytes.
 */
export function fromBase64Url(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
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
 * Encode data for URL fragment with optional compression.
 * Adds version prefix byte for format detection.
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
 * Handles both compressed and uncompressed formats.
 */
export async function decodeFragment(fragment: string): Promise<Uint8Array> {
  const payload = fromBase64Url(fragment);

  if (payload.length === 0) {
    throw new Error('Empty fragment');
  }

  const version = payload[0];
  const data = payload.slice(1);

  switch (version) {
    case VERSION_UNCOMPRESSED:
      return data;
    case VERSION_DEFLATE_RAW:
      return decompress(data);
    default:
      throw new Error(`Unknown fragment format version: ${version}`);
  }
}
```

### URL Creation with Size Validation
```typescript
// Source: Browser compatibility research + project requirements

const MAX_URL_LENGTH = 2 * 1024 * 1024; // 2MB - Chrome limit
const BASE_URL = 'https://cose-hpke.github.io/decrypt';

export class UrlTooLargeError extends Error {
  constructor(
    public actualSize: number,
    public maxSize: number
  ) {
    const actualMB = (actualSize / (1024 * 1024)).toFixed(2);
    const maxMB = (maxSize / (1024 * 1024)).toFixed(2);
    super(`URL exceeds maximum length: ${actualMB}MB > ${maxMB}MB limit`);
    this.name = 'UrlTooLargeError';
  }
}

export async function createShareableUrl(
  ciphertext: Uint8Array,
  baseUrl: string = BASE_URL
): Promise<string> {
  const fragment = await encodeFragment(ciphertext);
  const url = `${baseUrl}#${fragment}`;

  if (url.length > MAX_URL_LENGTH) {
    throw new UrlTooLargeError(url.length, MAX_URL_LENGTH);
  }

  return url;
}

export async function parseShareableUrl(url: string): Promise<Uint8Array> {
  const parsed = new URL(url);
  const fragment = parsed.hash.slice(1); // Remove leading #

  if (!fragment) {
    throw new Error('URL has no fragment');
  }

  return decodeFragment(fragment);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pako/zlib.js polyfills | CompressionStream native | May 2023 (browser baseline) | No dependencies needed |
| Manual stream handling | Response.arrayBuffer() | Always available | Simpler code, Safari compatible |
| gzip for transport | deflate-raw | Best practice | 10-11 bytes smaller per message |

**Deprecated/outdated:**
- **pako for compression**: No longer needed in modern environments, CompressionStream is universal
- **for-await stream iteration**: Safari incompatible, use Response pattern instead

## Open Questions

Things that couldn't be fully resolved:

1. **Exact compression ratio for COSE messages**
   - What we know: Compression works well for repetitive data, COSE has some structure
   - What's unclear: Typical ratio for COSE-HPKE encrypted messages (ciphertext is random-looking)
   - Recommendation: Test with real encrypted messages; may get little/no benefit since ciphertext is essentially random bytes

2. **Should existing URLs without version prefix still work?**
   - What we know: Current CLI creates URLs without compression (no version prefix)
   - What's unclear: Whether backward compatibility is required
   - Recommendation: Check if any URLs have been shared already; if so, add fallback to try uncompressed decode first

## Sources

### Primary (HIGH confidence)
- [MDN CompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream) - Complete API reference
- [MDN DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream) - Complete API reference
- [Chrome DevRel Compression Streams API](https://developer.chrome.com/blog/compression-streams-api) - Usage patterns
- [Bun v1.3.3 Release Notes](https://bun.com/blog/bun-v1.3.3) - Confirmed CompressionStream support

### Secondary (MEDIUM confidence)
- [web.dev Compression Streams](https://web.dev/blog/compressionstreams) - Browser support baseline
- [Bun gzip guide](https://bun.sh/guides/util/gzip) - Bun-specific compression options
- [DEV.to ArrayBuffer compression](https://dev.to/lucasdamianjohnson/compress-decompress-an-arraybuffer-client-side-in-js-2nf6) - Helper function patterns

### Tertiary (LOW confidence)
- [Browser URL length limits](https://www.geeksforgeeks.org/computer-networks/maximum-length-of-url-in-different-browsers/) - Various sources report different limits

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - CompressionStream is well-documented Web API
- Architecture: HIGH - Patterns verified with working code in Bun 1.3.6
- Pitfalls: HIGH - Safari limitation and TypeError documented in official sources
- URL limits: MEDIUM - Sources conflict; 2MB Chrome limit is well-documented

**Research date:** 2026-01-19
**Valid until:** 2026-03-19 (60 days - stable APIs, unlikely to change)
