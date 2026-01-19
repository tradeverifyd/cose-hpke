# Project Research Summary

**Project:** COSE-HPKE TypeScript/Bun Implementation
**Domain:** Cryptographic library (COSE-HPKE per draft-ietf-cose-hpke-20)
**Researched:** 2026-01-19
**Confidence:** HIGH

## Executive Summary

This project implements COSE-HPKE, a specification that combines COSE (CBOR Object Signing and Encryption) with HPKE (Hybrid Public Key Encryption) for modern cryptographic messaging. The core value proposition is URL-fragment-based encrypted message sharing where payloads never touch servers. The recommended approach uses **Bun** as the runtime/bundler, **cbor2** for CBOR serialization with diagnostic notation support, and **@panva/hpke** (user-specified) for HPKE operations including the @panva/hpke-noble extension for X25519 and ChaCha20Poly1305 support.

The implementation should start with HPKE-7 (P-256 + AES-256-GCM) using pure WebCrypto, then add HPKE-4 (X25519 + ChaCha20Poly1305) via @noble libraries. The architecture follows a layered approach: crypto primitives at the bottom, HPKE operations above that, COSE structure encoding above HPKE, and application layers (CLI/web demo) at the top. This ordering is critical because each layer depends on stable interfaces below it.

Key risks include: **HPKE context reuse** (catastrophic nonce collision), **non-deterministic CBOR encoding** (signature/hash failures), and **localStorage XSS exposure** for browser key storage. The context reuse risk is mitigated by creating fresh contexts per operation. CBOR determinism is handled by configuring cbor2 properly. localStorage risk requires explicit documentation, CSP headers, and user warnings.

## Key Findings

### Recommended Stack

The stack centers on Bun (v1.3.3+) as a unified runtime/bundler/test runner with native TypeScript support. CompressionStream support landed in Bun 1.3.3, making native compression viable. **Critical caveat:** Bun's WebCrypto has incomplete X25519 support, requiring @panva/hpke-noble for HPKE-4.

**Core technologies:**
- **Bun 1.3.3+**: Runtime/bundler/test runner — unified toolchain, fast startup, native TS
- **@panva/hpke** (user-specified): HPKE implementation — zero deps, WebCrypto-based, explicit Bun support
- **@panva/hpke-noble**: X25519 + ChaCha20Poly1305 — works around Bun's incomplete WebCrypto
- **cbor2**: CBOR encoding — modern web-first design, `diagnose()` function for diagnostic notation
- **citty**: CLI framework — lightweight, TypeScript-first

**Version requirements:**
- Bun >= 1.3.3 (CompressionStream)
- TypeScript >= 5.7
- Browser: ES2020+ (WebCrypto required)

### Expected Features

**Must have (table stakes):**
- HPKE Seal/Unseal operations (core RFC 9180)
- Integrated encryption mode (COSE_Encrypt0) for single recipient
- COSE_Key format for key representation
- `ek` header parameter (encapsulated key)
- `alg` in protected header
- Proper AAD construction per RFC 9052 Section 5.3
- Key generation (P-256, X25519)
- Basic encrypt/decrypt API

**Should have (differentiators):**
- URL fragment message transport (payload never hits server)
- Compression via Web Streams API
- CDDL diagnostic notation display
- Browser-native demo (GitHub Pages)
- Named key storage (localStorage)
- CLI with shareable URL output
- Both HPKE-4 and HPKE-7 cipher suites

**Defer (v2+):**
- Key Encryption mode (COSE_Encrypt) for multiple recipients
- Additional cipher suites beyond HPKE-4/HPKE-7
- PSK/Auth modes
- WASM builds
- Hardware key support

### Architecture Approach

The architecture is layered with clear boundaries. The bottom layer provides crypto primitives (WebCrypto + @noble). Above that, @panva/hpke provides HPKE operations. The COSE layer builds COSE_Encrypt0, COSE_Key, and header structures using cbor2. The public API exposes `encrypt()`, `decrypt()`, `generateKeyPair()`. Applications (CLI and web demo) consume the public API.

**Major components:**
1. **Serialization Layer** — CBOR encode/decode, base64url, diagnostic notation (cbor2)
2. **COSE Layer** — COSE_Encrypt0, COSE_Key builders/parsers, header management
3. **HPKE Core** — Cipher suite abstraction, seal/open operations (@panva/hpke)
4. **Public API** — High-level encrypt/decrypt/keygen functions
5. **Storage** — KeyStorage interface with file (CLI) and localStorage (web) implementations
6. **CLI** — keygen, encrypt, decrypt commands (citty)
7. **Web Demo** — Encrypt/decrypt pages with URL fragment handling

### Critical Pitfalls

1. **HPKE Context Reuse** — Creates nonce collision, total confidentiality loss. **Avoid by:** Fresh context per operation, never store/cache contexts.

2. **ChaCha20Poly1305 Not in WebCrypto** — HPKE-4 cannot use pure WebCrypto. **Avoid by:** Use @panva/hpke-noble which wraps @noble/ciphers.

3. **Non-Deterministic CBOR** — Different encodings break signatures/hashes. **Avoid by:** Configure cbor2 for deterministic encoding.

4. **AAD Omission** — Missing Enc_structure enables header manipulation. **Avoid by:** Follow RFC 9052 Section 5.3 exactly.

5. **localStorage XSS** — Any XSS compromises all stored keys. **Avoid by:** Strict CSP, SRI, explicit risk documentation, user warnings.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation

**Rationale:** Everything depends on types, CBOR encoding, and base64url. Cannot build COSE structures without serialization working first.

**Delivers:**
- TypeScript type definitions for COSE and HPKE
- CBOR encode/decode wrapper with deterministic encoding
- Base64url encode/decode
- Compression utilities (CompressionStream wrapper)

**Addresses:** Deterministic CBOR encoding, base64url handling
**Avoids:** Pitfall #7 (non-deterministic CBOR), Pitfall #14 (base64url padding)

### Phase 2: COSE Structures

**Rationale:** COSE_Key and COSE_Encrypt0 structures must exist before HPKE integration. The structures define the message format.

**Delivers:**
- COSE_Key builder/parser (EC2 for P-256, OKP for X25519)
- Header handling (protected/unprotected buckets)
- COSE_Encrypt0 structure builder/parser
- AAD construction (Enc_structure per RFC 9052)

**Uses:** Serialization layer from Phase 1
**Avoids:** Pitfall #8 (EC2/OKP parameter confusion), Pitfall #10 (AAD omission)

### Phase 3: HPKE Integration

**Rationale:** With structures in place, integrate @panva/hpke for actual crypto operations. Start with HPKE-7 (WebCrypto-only) then add HPKE-4.

**Delivers:**
- Cipher suite abstraction (HPKE-7 first, HPKE-4 second)
- Key generation for P-256 and X25519
- Integrated encryption (Seal/Open with COSE_Encrypt0)
- Fresh context per operation enforcement

**Uses:** @panva/hpke + @panva/hpke-noble
**Avoids:** Pitfall #1 (context reuse), Pitfall #2 (bad randomness), Pitfall #6 (ChaCha20 not in WebCrypto)

### Phase 4: Public API and Storage

**Rationale:** With core crypto working, expose clean API and add key persistence for both CLI and browser.

**Delivers:**
- Public API: `encrypt()`, `decrypt()`, `generateKeyPair()`
- KeyStorage interface
- FileKeyStorage (Bun file system)
- LocalStorageKeyStorage (browser)

**Addresses:** Key storage features
**Avoids:** Pitfall #5 (localStorage XSS) via documentation and CSP guidance

### Phase 5: CLI Application

**Rationale:** CLI is primary developer interface. Build after public API is stable.

**Delivers:**
- keygen command
- encrypt command (URL output by default)
- decrypt command
- CDDL diagnostic notation display

**Uses:** Public API, FileKeyStorage, citty framework
**Addresses:** CLI features from FEATURES.md

### Phase 6: Web Demo

**Rationale:** Browser demo validates URL fragment transport and provides zero-install experience. Build last because it's an application layer.

**Delivers:**
- Encrypt page (create shareable URL)
- Decrypt page (read URL fragment, decrypt)
- Key management UI
- localStorage key storage integration
- URL length warnings

**Addresses:** URL fragment transport, browser demo
**Avoids:** Pitfall #11 (URL size limits), Pitfall #12 (decompression bomb)

### Phase Ordering Rationale

- **Bottom-up dependency chain:** Types/serialization must exist before structures, structures before crypto integration, crypto before applications
- **HPKE-7 before HPKE-4:** P-256 + AES-GCM works with pure WebCrypto; validates architecture before adding @noble dependency
- **CLI before Web:** CLI is simpler to test and debug; validates public API before browser integration
- **Compression integrated early:** URL fragment use case needs small payloads; bake compression into design from start

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (HPKE Integration):** May need to verify @panva/hpke API specifics and algorithm ID mappings for COSE-HPKE draft-20
- **Phase 6 (Web Demo):** Browser-specific edge cases (Safari URL limits, CSP configuration) may surface

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** CBOR/base64url are well-documented
- **Phase 4 (Public API):** Standard API design patterns
- **Phase 5 (CLI):** citty has clear docs, straightforward command structure

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official library docs, explicit Bun support documented |
| Features | HIGH | Spec-driven (draft-ietf-cose-hpke-20), clear requirements |
| Architecture | HIGH | Based on RFC patterns, established crypto library designs |
| Pitfalls | HIGH | Verified against RFCs and security research |

**Overall confidence:** HIGH

### Gaps to Address

- **draft-ietf-cose-hpke version alignment:** Verify algorithm IDs match draft-20 (42/48 for HPKE-4, 44/50 for HPKE-7 in different modes)
- **Safari URL limits:** Research indicates ~80KB practical limit; need to validate and set appropriate warning thresholds
- **@panva/hpke API:** Confirm exact import paths and mixing of Web Crypto / @noble algorithms

## Sources

### Primary (HIGH confidence)
- [draft-ietf-cose-hpke](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/) — Primary specification
- [RFC 9180](https://www.rfc-editor.org/rfc/rfc9180.html) — HPKE base standard
- [RFC 9052](https://datatracker.ietf.org/doc/rfc9052/) — COSE structures and process
- [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949.html) — CBOR encoding

### Secondary (MEDIUM confidence)
- [@panva/hpke GitHub](https://github.com/panva/hpke) — HPKE library (user-specified)
- [cbor2 GitHub](https://github.com/hildjj/cbor2) — CBOR library documentation
- [Bun documentation](https://bun.com/docs) — Runtime capabilities
- [citty GitHub](https://github.com/unjs/citty) — CLI framework

### Tertiary (LOW confidence)
- URL length limits vary by platform; 2000 chars is conservative safe limit
- localStorage security research from Auth0/Pomcor provides guidance but may have implementation-specific variations

---
*Research completed: 2026-01-19*
*Ready for roadmap: yes*
