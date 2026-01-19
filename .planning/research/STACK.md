# Technology Stack

**Project:** COSE-HPKE TypeScript/Bun Implementation
**Researched:** 2026-01-19
**Overall Confidence:** HIGH

## Recommended Stack

### Runtime & Language

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Bun** | ^1.3.3+ | Runtime, bundler, test runner | Native TypeScript, fast startup, built-in bundler, CompressionStream support (v1.3.3+) | HIGH |
| **TypeScript** | ^5.7 | Type safety | Industry standard, required for type-safe HPKE usage | HIGH |

**Rationale:** Bun provides a unified toolchain (runtime + bundler + test runner + package manager) eliminating configuration complexity. As of v1.3.3 (December 2025), Bun has native CompressionStream/DecompressionStream support including gzip, deflate, brotli, and zstd formats.

**Critical Note on Bun Crypto:** Bun's Web Crypto API has incomplete X25519 support. The `deriveBits` and `deriveKey` operations fail with "algorithm not supported." This is why we must use `@panva/hpke-noble` for X25519 and ChaCha20Poly1305 support.

### CBOR Serialization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **cbor2** | ^2.0.1 | CBOR encoding/decoding | Modern web-first design, diagnostic notation support, actively maintained successor to node-cbor | HIGH |

**Rationale:**
- **cbor2** is the recommended choice by the node-cbor maintainer for new projects
- Provides `diagnose()` function for CBOR diagnostic notation display (project requirement)
- Web-first design works in browser, Node.js, Deno, and Bun
- Requires Node 20+ (Bun 1.x is compatible)
- Synchronous API simplifies usage patterns

**Alternative Considered:**

| Library | Why Not |
|---------|---------|
| **cbor** (node-cbor) | Legacy - maintainer recommends migration to cbor2 |
| **cbor-x** | Faster but no built-in diagnostic notation; streaming focus less relevant for COSE messages |
| **CBOR.js** | Less ecosystem adoption, different API style |

### HPKE Implementation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **hpke** | ^1.0.0 | Core HPKE implementation | Zero dependencies, Web Crypto based, tree-shakeable ESM | HIGH |
| **@panva/hpke-noble** | ^1.0.0 | X25519 + ChaCha20Poly1305 | Uses @noble libs, works around Bun's incomplete Web Crypto | HIGH |

**Rationale:**
- **hpke** by @panva is a modern, zero-dependency HPKE implementation for Web-interoperable runtimes
- Explicitly supports Bun, browsers, Cloudflare Workers, Deno, and Node.js
- Clean API: `CipherSuite`, `GenerateKeyPair()`, `Seal()`, `Open()`
- `@panva/hpke-noble` provides X25519 and ChaCha20Poly1305 using @noble libraries
- Allows mixing Web Crypto algorithms (P-256, AES-GCM) with @noble implementations (X25519, ChaCha20Poly1305)

**COSE-HPKE Cipher Suite Mapping:**

| Cipher Suite | COSE Alg ID | KEM | KDF | AEAD | Implementation |
|--------------|-------------|-----|-----|------|----------------|
| **HPKE-4** | 42 (IE), 48 (KE) | DHKEM(X25519, HKDF-SHA256) | HKDF-SHA256 | ChaCha20Poly1305 | @panva/hpke-noble for KEM + AEAD |
| **HPKE-7** | 44 (IE), 50 (KE) | DHKEM(P-256, HKDF-SHA256) | HKDF-SHA256 | AES-256-GCM | hpke (Web Crypto) |

**Usage Example:**

```typescript
import * as HPKE from 'hpke'
import { KEM, AEAD } from '@panva/hpke-noble'

// HPKE-4: X25519 + ChaCha20Poly1305 (via @noble)
const suiteHpke4 = new HPKE.CipherSuite(
  KEM.X25519,           // @panva/hpke-noble
  HPKE.KDF_HKDF_SHA256, // Web Crypto
  AEAD.ChaCha20Poly1305 // @panva/hpke-noble
)

// HPKE-7: P-256 + AES-256-GCM (Web Crypto)
const suiteHpke7 = new HPKE.CipherSuite(
  HPKE.KEM_DHKEM_P256_HKDF_SHA256,
  HPKE.KDF_HKDF_SHA256,
  HPKE.AEAD_AES_256_GCM
)
```

**Alternative Considered:**

| Library | Why Not |
|---------|---------|
| **hpke-js / @hpke/*** | More complex modular structure, same underlying @noble dependency |
| **Custom implementation** | Unnecessary complexity, security risk |

### Crypto Primitives (Transitive Dependencies)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **@noble/curves** | ^2.0.1 | X25519 elliptic curve | Audited, pure JS, no Web Crypto dependency, transitive via @panva/hpke-noble | HIGH |
| **@noble/ciphers** | ^1.x | ChaCha20Poly1305 | Audited, pure JS, transitive via @panva/hpke-noble | HIGH |

**Note:** These are transitive dependencies of @panva/hpke-noble. You don't install them directly but should be aware they're being used.

### CLI Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **citty** | ^0.1.6 | CLI argument parsing | Lightweight (mri-based), TypeScript-first, UnJS ecosystem | MEDIUM |

**Rationale:**
- citty is lightweight (~5KB) with minimal dependencies
- Native TypeScript with excellent type inference for arguments
- Simple API: `defineCommand`, `runMain`
- Works well with Bun's fast startup time
- Part of UnJS ecosystem (same team as unbuild, nuxt)

**Alternatives Considered:**

| Library | Why Not |
|---------|---------|
| **commander** | More dependencies, overkill for simple CLI |
| **yargs** | Heavy, slower startup |
| **oclif** | Enterprise-grade, unnecessary complexity |
| **No framework** | `process.argv` parsing is error-prone |

### Build & Development

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Bun bundler** | (built-in) | Library bundling | Native Bun, zero config, HTML support | HIGH |
| **bun:test** | (built-in) | Testing | Jest-compatible API, fast, TypeScript support | HIGH |

**Rationale:**
- Bun's built-in bundler handles TypeScript, tree-shaking, and multiple output formats (ESM, CJS)
- Bun's test runner is 2x faster than Node's test runner
- Both use the same TypeScript configuration, reducing config complexity
- HTML bundling support simplifies GitHub Pages demo build

**Alternatives Considered:**

| Tool | Why Not |
|------|---------|
| **tsup** | External dependency, slower than Bun bundler (5.4s vs 37ms) |
| **vitest** | Excellent but unnecessary when using Bun runtime |
| **esbuild** | Bun bundler wraps esbuild internally |

### Web Demo (GitHub Pages)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Vanilla HTML/TS** | - | Demo UI | No framework overhead, direct Web Crypto usage | MEDIUM |
| **Bun HTML bundler** | (built-in) | Static build | Single HTML entry point bundling | HIGH |

**Rationale:**
- GitHub Pages demo is simple enough that no framework is needed
- Bun's HTML bundler can build from HTML entry point directly
- URL fragment message passing requires no backend
- Web Crypto API for P-256/AES-GCM works in all modern browsers
- ChaCha20Poly1305 via @noble/ciphers works in browser too

## Installation

```bash
# Initialize Bun project
bun init

# Core dependencies
bun add cbor2 hpke @panva/hpke-noble citty

# Dev dependencies
bun add -d typescript @types/bun
```

## Package.json Scripts

```json
{
  "scripts": {
    "build": "bun build ./src/index.ts --outdir ./dist --target node",
    "build:browser": "bun build ./src/browser.ts --outdir ./dist --target browser",
    "build:demo": "bun build ./demo/index.html --outdir ./docs",
    "test": "bun test",
    "cli": "bun run ./src/cli.ts"
  }
}
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "test/**/*"]
}
```

## Project Structure

```
cose-hpke/
  src/
    index.ts          # Main library exports
    cli.ts            # CLI entry point
    cose/
      keys.ts         # COSE_Key format handling
      encrypt.ts      # COSE_Encrypt structure
      recipient.ts    # COSE_Recipient for key encryption mode
    hpke/
      suites.ts       # HPKE-4, HPKE-7 cipher suite configs
      integrated.ts   # Integrated encryption mode
      key-encryption.ts # Key encryption mode
    util/
      cbor.ts         # CBOR encoding + diagnostic notation
      compression.ts  # Web Streams compression
  demo/
    index.html        # GitHub Pages demo
    app.ts            # Demo application code
  test/
    *.test.ts         # Test files
  dist/               # Build output
  docs/               # GitHub Pages output
```

## Version Compatibility Matrix

| Component | Minimum Version | Tested Version | Notes |
|-----------|----------------|----------------|-------|
| Bun | 1.3.3 | 1.3.6+ | CompressionStream requires 1.3.3+ |
| Node.js | 20.0 | - | If running outside Bun |
| TypeScript | 5.0 | 5.7 | Modern module resolution |
| Browser | ES2020 | - | Web Crypto API required |

## Key Decisions Summary

1. **cbor2 over cbor-x**: Diagnostic notation support is a project requirement; cbor2 provides `diagnose()` function out of the box.

2. **hpke + @panva/hpke-noble**: Clean API, explicit Bun support, allows mixing Web Crypto (P-256, AES-GCM) with @noble (X25519, ChaCha20Poly1305).

3. **@panva/hpke-noble (mandatory for HPKE-4)**: Works around Bun's incomplete X25519 Web Crypto implementation by using @noble/curves.

4. **citty over commander**: Lighter weight, TypeScript-first, aligns with modern UnJS ecosystem.

5. **Bun built-ins over external tools**: Bundler, test runner, and package manager are unified, reducing config complexity.

6. **No COSE library dependency**: Existing COSE libraries (cose-js, @ldclabs/cose-ts) don't support HPKE; we implement COSE-HPKE structures directly using cbor2.

## Sources

### Official Documentation
- [Bun Web Crypto API](https://bun.com/reference/node/crypto)
- [Bun Bundler](https://bun.com/docs/bundler)
- [Bun HTML Bundling](https://bun.com/docs/bundler/html-static)
- [Bun Test Runner](https://bun.com/docs/test)

### Library Documentation
- [hpke (panva) GitHub](https://github.com/panva/hpke)
- [cbor2 GitHub](https://github.com/hildjj/cbor2)
- [noble-curves GitHub](https://github.com/paulmillr/noble-curves)
- [citty GitHub](https://github.com/unjs/citty)

### Standards
- [draft-ietf-cose-hpke (COSE-HPKE spec)](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/)
- [RFC 9180 (HPKE)](https://datatracker.ietf.org/doc/rfc9180/)
- [RFC 8949 (CBOR)](https://datatracker.ietf.org/doc/rfc8949/)

### Known Issues
- [Bun X25519 Web Crypto Issue #24409](https://github.com/oven-sh/bun/issues/24409)
