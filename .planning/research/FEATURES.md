# Feature Research

**Domain:** COSE-HPKE Implementation (draft-ietf-cose-hpke-20)
**Researched:** 2026-01-19
**Confidence:** HIGH (spec-driven, authoritative sources)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that are non-negotiable for a compliant COSE-HPKE implementation. Missing these means the implementation is incomplete or non-compliant.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **HPKE Seal/Unseal operations** | Core RFC 9180 functionality | MEDIUM | Encryption context creation, seal for encrypt, open for decrypt |
| **Integrated Encryption mode (COSE_Encrypt0)** | Required by spec for single-recipient scenarios | MEDIUM | Direct plaintext encryption via HPKE, single recipient only |
| **Key Encryption mode (COSE_Encrypt)** | Required by spec for multi-recipient scenarios | HIGH | Two-layer: HPKE encrypts CEK, CEK encrypts content |
| **`ek` header parameter** | Mandatory per spec - carries encapsulated key | LOW | Must be in unprotected header as bstr |
| **`alg` in protected header** | Mandatory per spec - identifies cipher suite | LOW | HPKE-4 or HPKE-7 algorithm identifier |
| **COSE_Key format** | Standard key representation for COSE | MEDIUM | Support EC2 (P-256) and OKP (X25519) key types |
| **At least one cipher suite** | Spec requires implementing at least one | MEDIUM | Project targets HPKE-4 and HPKE-7 |
| **Proper AAD construction** | Required for authenticated encryption | LOW | Context string per RFC 9052 Section 5.3 |
| **Recipient_structure for Key Encryption** | Replaces COSE_KDF_Context per spec | MEDIUM | "HPKE Recipient" context identifier |
| **Deterministic CBOR encoding** | Required for protected headers | MEDIUM | CBOR canonical encoding for integrity |
| **Key generation** | Users need to create keypairs | LOW | Generate P-256 or X25519 keypairs |
| **Basic encrypt/decrypt API** | Core library functionality | MEDIUM | Clean API surface for encryption operations |

### Differentiators (Competitive Advantage)

Features that set this implementation apart. Not required by spec, but valuable for the target use case.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **URL fragment message transport** | Core value proposition - payload never hits server | MEDIUM | Unique privacy feature, fragment-only transport |
| **Compression (Web Streams API)** | Smaller URLs, better sharing experience | LOW | CompressionStream/DecompressionStream built-in |
| **CDDL diagnostic notation display** | Human-readable CBOR for debugging/transparency | MEDIUM | Spec-compliant diagnostic output, aids understanding |
| **Browser-native demo** | Zero-install experience, instant adoption | HIGH | GitHub Pages static hosting, full client-side |
| **Named key storage (localStorage)** | Persistent identity across sessions | LOW | User-controlled key management |
| **CLI with shareable URL output** | Workflow integration, scriptable | MEDIUM | Default to URL output, file optional |
| **Bun-native performance** | Fast CLI operations, modern runtime | LOW | Leverage Bun APIs where beneficial |
| **Both P-256 and X25519 support** | Flexibility for different security requirements | MEDIUM | WebCrypto native (P-256) + library (X25519) |
| **Test vector validation** | Confidence in interoperability | MEDIUM | Validate against RFC 9180 / draft-ietf-cose-hpke test vectors |
| **Multiple recipient support** | Practical for group sharing | HIGH | Key Encryption mode with multiple COSE_Recipient structures |
| **Base64url encoding** | URL-safe representation | LOW | Standard for URL fragment transport |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but create problems. Explicitly NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **All 8 HPKE cipher suites** | "Completeness" | Bloats implementation, rarely needed. X448 adds complexity without matching browser support | Support HPKE-4 and HPKE-7 only, covering modern curves |
| **PSK authentication mode** | Added security layer | Complexity for key management, PSK distribution is its own problem | Base mode is sufficient for URL sharing use case |
| **Auth/AuthPSK modes** | Sender authentication | Requires sender private key management, complicates UX | Signing is orthogonal - use COSE_Sign if needed |
| **Server-side encryption** | "Full-featured" | Defeats privacy goal (fragment never leaves client) | Client-side only is the feature |
| **Custom KDF contexts** | Flexibility | Interoperability nightmare, easy to misuse | Use spec-defined contexts |
| **Detached ciphertext** | Separate header from payload | Complicates URL sharing, two-part messages | Embedded ciphertext for single-URL sharing |
| **COSE_KDF_Context support** | "Backwards compatibility" | Explicitly prohibited by COSE-HPKE spec for HPKE recipients | Use Recipient_structure only |
| **Arbitrary AEAD algorithms** | Extensibility | Security risk, potential for downgrade attacks | Fixed to spec-defined algorithms |
| **Private key export** | User "control" | Security risk, encourages bad practices | Keys stay in storage, export public key only |
| **Automatic key backup** | Convenience | Privacy concern, requires trust in backup destination | User manually exports if needed |
| **Real-time sync** | Multi-device | Server dependency defeats client-only architecture | Manual key transfer between devices |

## Feature Dependencies

```
[CBOR Encoding Library]
    |
    +---> [COSE_Key Format] ---> [Key Generation CLI]
    |           |
    |           +---> [CDDL Diagnostic Display]
    |
    +---> [COSE_Encrypt0 Structure]
    |           |
    |           +--requires---> [HPKE Seal/Unseal] ---> [Integrated Encryption Mode]
    |                                   |
    +---> [COSE_Encrypt Structure]      +---> [Basic Encrypt/Decrypt API]
                |                                   |
                +--requires---> [Recipient_structure]    +---> [CLI encrypt/decrypt]
                |                                              |
                +--requires---> [CEK Generation]               +---> [URL Fragment Output]
                |                                                      |
                +---> [Key Encryption Mode]                            +---> [Demo Page Encryption]
                            |                                                      |
                            +---> [Multiple Recipients]                            +---> [Demo Page Decryption]

[Compression (Web Streams)]
    |
    +--enhances---> [URL Fragment Output]
    |
    +--enhances---> [Demo Page]

[localStorage Key Storage]
    |
    +--enhances---> [Demo Page Encryption/Decryption]
    |
    +--requires---> [COSE_Key Format]

[X25519 Support (library)]
    |
    +--enables---> [HPKE-4 Cipher Suite]

[P-256 Support (WebCrypto)]
    |
    +--enables---> [HPKE-7 Cipher Suite]

[ChaCha20Poly1305 (library)]
    |
    +--enables---> [HPKE-4 Cipher Suite]

[AES-256-GCM (WebCrypto)]
    |
    +--enables---> [HPKE-7 Cipher Suite]
```

### Dependency Notes

- **HPKE Seal/Unseal requires crypto primitives:** Must have working KEM (X25519 or P-256), KDF (HKDF-SHA256), and AEAD (ChaCha20Poly1305 or AES-256-GCM) before HPKE operations work
- **Integrated Encryption requires COSE_Encrypt0:** Cannot do integrated mode without basic COSE structure encoding
- **Key Encryption requires Recipient_structure:** Spec mandates this structure, cannot use COSE_KDF_Context
- **URL Fragment Output requires Compression:** For practical URL lengths, compression is essential (not strictly required but practically necessary)
- **Demo requires localStorage:** Without key storage, demo would require re-entering keys each session
- **HPKE-4 requires external library:** WebCrypto does not support X25519 ECDH or ChaCha20Poly1305 in browsers
- **HPKE-7 can use native WebCrypto:** P-256 and AES-256-GCM are natively supported

## MVP Definition

### Launch With (v1)

Minimum viable product for validating the URL-sharing concept.

- [x] **HPKE-7 cipher suite (P-256 + AES-256-GCM)** - WebCrypto native, no dependencies for browser
- [x] **Integrated encryption mode (COSE_Encrypt0)** - Simpler, single recipient covers sharing use case
- [x] **COSE_Key format** - Standard key representation
- [x] **CLI: keygen** - Generate keypairs
- [x] **CLI: encrypt (URL output)** - Core sharing workflow
- [x] **CLI: decrypt** - Complete the loop
- [x] **Demo: encrypt page** - Browser-based encryption
- [x] **Demo: decrypt page** - Browser-based decryption from URL
- [x] **localStorage key storage** - Persist keys in demo
- [x] **Compression** - Practical URL lengths
- [x] **Base64url encoding** - URL-safe fragment

### Add After Validation (v1.x)

Features to add once core is working and validated.

- [ ] **HPKE-4 cipher suite (X25519 + ChaCha20Poly1305)** - Add after validating core works, requires external crypto library
- [ ] **Key Encryption mode (COSE_Encrypt)** - Multi-recipient support
- [ ] **Multiple recipients** - Group sharing capability
- [ ] **CDDL diagnostic notation display** - Developer-friendly debugging
- [ ] **Test vector validation** - Conformance testing against spec vectors
- [ ] **File output option for CLI** - Alternative to URL for large messages

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Additional cipher suites** - Only if user demand
- [ ] **WASM builds** - Performance optimization for heavy usage
- [ ] **Key rotation helpers** - Enterprise feature
- [ ] **Audit logging** - Enterprise/compliance feature
- [ ] **Hardware key support (WebAuthn integration)** - Advanced security

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Integrated Encryption (COSE_Encrypt0) | HIGH | MEDIUM | P1 |
| HPKE-7 (P-256 + AES-256-GCM) | HIGH | MEDIUM | P1 |
| COSE_Key format | HIGH | LOW | P1 |
| CLI keygen/encrypt/decrypt | HIGH | MEDIUM | P1 |
| Demo page encrypt/decrypt | HIGH | HIGH | P1 |
| URL fragment output | HIGH | LOW | P1 |
| Compression | HIGH | LOW | P1 |
| localStorage keys | MEDIUM | LOW | P1 |
| HPKE-4 (X25519 + ChaCha20Poly1305) | MEDIUM | HIGH | P2 |
| Key Encryption mode | MEDIUM | HIGH | P2 |
| Multiple recipients | MEDIUM | MEDIUM | P2 |
| CDDL diagnostic display | LOW | MEDIUM | P2 |
| Test vector validation | MEDIUM | MEDIUM | P2 |
| File output for CLI | LOW | LOW | P3 |
| Additional cipher suites | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch - validates core concept
- P2: Should have, add when possible - improves adoption
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | hpke-js (dajiaji) | hpke (panva) | cose-js | Our Approach |
|---------|-------------------|--------------|---------|--------------|
| HPKE RFC 9180 | Full support | Full support | No HPKE | Full support for HPKE-4, HPKE-7 |
| COSE integration | None | None | COSE but no HPKE | Native COSE-HPKE per draft-20 |
| Browser support | Yes (WebCrypto) | Yes (WebCrypto) | Node.js focus | Browser-first with demo |
| Bun support | Yes | Yes | Unknown | Native Bun CLI |
| X25519 | Yes (extension) | Yes (@noble) | N/A | Yes (library required) |
| ChaCha20Poly1305 | Yes (extension) | Yes (@noble) | N/A | Yes (library required) |
| CLI | None | None | None | Full CLI with URL output |
| Demo/UI | None | None | None | GitHub Pages demo |
| URL sharing | None | None | None | Core feature |
| Compression | None | None | None | Web Streams API |
| CDDL display | None | None | None | Yes |

**Key differentiators:**
1. **COSE-HPKE integration** - No existing JS library combines HPKE with COSE per the draft spec
2. **URL fragment sharing** - Unique privacy-preserving transport mechanism
3. **Complete developer experience** - CLI + Library + Demo in one package
4. **Compression built-in** - Practical URL lengths for real-world sharing

## Sources

### Authoritative (HIGH confidence)
- [draft-ietf-cose-hpke IETF Datatracker](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/) - Primary specification
- [RFC 9180 - HPKE](https://datatracker.ietf.org/doc/rfc9180/) - Underlying HPKE standard
- [RFC 9052 - COSE Structures](https://datatracker.ietf.org/doc/rfc9052/) - COSE structure definitions
- [cose-wg/HPKE GitHub](https://github.com/cose-wg/HPKE) - Official working group repository

### Library Documentation (HIGH confidence)
- [hpke-js GitHub](https://github.com/dajiaji/hpke-js) - Leading HPKE JS implementation
- [hpke (panva) GitHub](https://github.com/panva/hpke) - Alternative HPKE implementation
- [cborg GitHub](https://github.com/rvagg/cborg) - CBOR library for strict encoding
- [cbor-x GitHub](https://github.com/kriszyp/cbor-x) - High-performance CBOR library

### Browser Compatibility (MEDIUM confidence)
- [Igalia Ed25519/X25519 in Chrome](https://blogs.igalia.com/jfernandez/2025/08/25/ed25519-support-lands-in-chrome-what-it-means-for-developers-and-the-web/) - X25519 now in WebCrypto
- [W3C WebCrypto ChaCha20 Issue](https://github.com/w3c/webcrypto/issues/223) - ChaCha20Poly1305 NOT in WebCrypto

### Community Resources (MEDIUM confidence)
- [JOSE-COSE HPKE Cookbook](https://or13.github.io/draft-steele-jose-cose-hpke-cookbook/) - Example implementations
- [CBOR.io Tools](https://cbor.io/tools.html) - CBOR/CDDL diagnostic tools

---
*Feature research for: COSE-HPKE Implementation*
*Researched: 2026-01-19*
