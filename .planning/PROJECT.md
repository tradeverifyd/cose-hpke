# COSE-HPKE

## What This Is

A Bun/TypeScript implementation of COSE-HPKE (draft-ietf-cose-hpke-20) providing hybrid public key encryption with CBOR serialization. Includes a CLI for key generation, encryption, and decryption, plus a GitHub Pages demo that enables secure message sharing via URL fragments — the encrypted payload never touches a server.

## Core Value

Enable end-to-end encrypted message sharing through shareable URLs where the encrypted content travels in the fragment and decryption happens entirely client-side.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] HPKE-4 cipher suite (X25519 + HKDF-SHA256 + ChaCha20Poly1305)
- [ ] HPKE-7 cipher suite (P-256 + HKDF-SHA256 + AES-256-GCM)
- [ ] Integrated encryption mode (single recipient, COSE_Encrypt0)
- [ ] Key encryption mode (multi-recipient, COSE_Encrypt with recipients)
- [ ] COSE_Key format for key representation
- [ ] CDDL diagnostic notation for displaying keys to users
- [ ] CLI: keygen command (generate keypairs)
- [ ] CLI: encrypt command (outputs shareable URL by default, file optional)
- [ ] CLI: decrypt command (accepts URL or file)
- [ ] Demo page: encryption with recipient selection
- [ ] Demo page: decryption from URL fragment
- [ ] Demo page: named key storage in localStorage (public + private keys)
- [ ] Demo page: compression via Web Streams API (CompressionStream/DecompressionStream)
- [ ] URL fragment message format: compress → base64url → fragment

### Out of Scope

- HPKE-0 through HPKE-3, HPKE-5, HPKE-6 cipher suites — only HPKE-4 and HPKE-7 for v1
- PSK (pre-shared key) authentication modes — base mode only
- Server-side encryption/decryption — this is a client-side tool
- Mobile apps — web demo only

## Context

**Specification:** draft-ietf-cose-hpke-20 defines how to use HPKE (RFC 9180) with COSE (RFC 9052). Two modes:
- Integrated encryption: HPKE directly encrypts plaintext, single recipient, uses COSE_Encrypt0
- Key encryption: HPKE encrypts a CEK which encrypts plaintext, supports multiple recipients

**Use case:** Share encrypted messages via links (e.g., in Slack). Recipient clicks URL, page loads, fragment is decoded/decompressed/decrypted client-side using private key from localStorage.

**Message flow:**
1. Encrypt: plaintext → COSE-HPKE encrypt → compress → base64url → URL fragment
2. Decrypt: URL fragment → base64url decode → decompress → COSE-HPKE decrypt → plaintext

## Constraints

- **Runtime**: Bun — use native Bun APIs where beneficial
- **Crypto**: WebCrypto API for P-256, need library for X25519/ChaCha20Poly1305
- **CBOR**: Need CBOR encoding/decoding library for COSE structures
- **Hosting**: GitHub Pages for demo (static only, no server)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| COSE_Key format | Native to spec, compact binary | — Pending |
| CDDL diagnostic notation for display | Human-readable, spec-compliant | — Pending |
| URL fragment for message transport | Privacy — fragment never sent to server | — Pending |
| Web Streams compression | Modern API, good browser support | — Pending |
| localStorage for keys | Simple persistence, user controls data | — Pending |

---
*Last updated: 2025-01-19 after initialization*
