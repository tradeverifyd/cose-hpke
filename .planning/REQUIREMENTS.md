# Requirements: COSE-HPKE

**Defined:** 2025-01-19
**Core Value:** Enable end-to-end encrypted message sharing through shareable URLs where the encrypted content travels in the fragment and decryption happens entirely client-side.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Library

- [ ] **CORE-01**: Library implements HPKE-7 cipher suite (P-256 + HKDF-SHA256 + AES-256-GCM)
- [ ] **CORE-02**: Library supports integrated encryption mode (COSE_Encrypt0, single recipient)
- [ ] **CORE-03**: Library supports key encryption mode (COSE_Encrypt, multiple recipients)
- [ ] **CORE-04**: Library generates COSE_Key keypairs for P-256
- [ ] **CORE-05**: Library parses and serializes COSE_Key format
- [ ] **CORE-06**: Library uses deterministic CBOR encoding
- [ ] **CORE-07**: Library displays keys in CDDL diagnostic notation

### CLI

- [ ] **CLI-01**: User can generate keypair via `keygen` command
- [ ] **CLI-02**: User can encrypt message via `encrypt` command
- [ ] **CLI-03**: User can decrypt message via `decrypt` command
- [ ] **CLI-04**: Encrypt outputs shareable URL by default
- [ ] **CLI-05**: Encrypt can output to file with `--output` flag
- [ ] **CLI-06**: Decrypt accepts URL or file path as input
- [ ] **CLI-07**: CLI displays keys in CDDL diagnostic notation

### Web Demo

- [ ] **WEB-01**: User can generate keypair in browser
- [ ] **WEB-02**: User can encrypt message by selecting recipient and entering plaintext
- [ ] **WEB-03**: User can decrypt message from URL fragment
- [ ] **WEB-04**: User can save public keys with names in localStorage
- [ ] **WEB-05**: User can save private keys with names in localStorage
- [ ] **WEB-06**: User can select saved keys for encryption/decryption
- [ ] **WEB-07**: Messages are compressed before encoding to URL
- [ ] **WEB-08**: Demo hosted on GitHub Pages

### URL Transport

- [ ] **URL-01**: Encrypted COSE message is compressed via CompressionStream
- [ ] **URL-02**: Compressed data is encoded as base64url
- [ ] **URL-03**: Encoded data is placed in URL fragment (never sent to server)
- [ ] **URL-04**: Decryption reverses: fragment → base64url decode → decompress → decrypt

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Cipher Suites

- **CIPHER-01**: HPKE-4 cipher suite (X25519 + HKDF-SHA256 + ChaCha20Poly1305)
- **CIPHER-02**: Additional cipher suites (HPKE-0 through HPKE-6)

### Advanced Features

- **ADV-01**: PSK (pre-shared key) authentication modes
- **ADV-02**: Export-only keys (non-extractable WebCrypto keys)
- **ADV-03**: Key derivation/rotation utilities

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Server-side encryption | Core value is client-side only |
| Mobile apps | Web demo sufficient for v1 |
| HPKE-0 through HPKE-6 | Only HPKE-7 for v1, HPKE-4 in v2 |
| PSK modes | Base mode sufficient for v1 |
| Key backup/sync | localStorage is user's responsibility |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | TBD | Pending |
| CORE-02 | TBD | Pending |
| CORE-03 | TBD | Pending |
| CORE-04 | TBD | Pending |
| CORE-05 | TBD | Pending |
| CORE-06 | TBD | Pending |
| CORE-07 | TBD | Pending |
| CLI-01 | TBD | Pending |
| CLI-02 | TBD | Pending |
| CLI-03 | TBD | Pending |
| CLI-04 | TBD | Pending |
| CLI-05 | TBD | Pending |
| CLI-06 | TBD | Pending |
| CLI-07 | TBD | Pending |
| WEB-01 | TBD | Pending |
| WEB-02 | TBD | Pending |
| WEB-03 | TBD | Pending |
| WEB-04 | TBD | Pending |
| WEB-05 | TBD | Pending |
| WEB-06 | TBD | Pending |
| WEB-07 | TBD | Pending |
| WEB-08 | TBD | Pending |
| URL-01 | TBD | Pending |
| URL-02 | TBD | Pending |
| URL-03 | TBD | Pending |
| URL-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 (pending roadmap)

---
*Requirements defined: 2025-01-19*
*Last updated: 2025-01-19 after initial definition*
