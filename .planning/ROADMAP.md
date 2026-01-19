# Roadmap: COSE-HPKE

## Overview

This roadmap delivers a TypeScript/Bun implementation of COSE-HPKE (draft-ietf-cose-hpke-20) with HPKE-7 cipher suite support. The journey starts with core cryptographic structures, adds a CLI for developer workflows, implements URL-fragment transport, and culminates in a browser demo for zero-server encrypted message sharing.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - Core library with COSE structures and HPKE-7 encryption
- [x] **Phase 2: CLI** - Command-line interface for keygen, encrypt, and decrypt
- [ ] **Phase 3: URL Transport** - Compression and URL fragment encoding/decoding
- [ ] **Phase 4: Web Demo** - Browser-based encryption with key storage and GitHub Pages hosting

## Phase Details

### Phase 1: Foundation
**Goal**: Users can generate P-256 keypairs and encrypt/decrypt messages using HPKE-7 in both integrated and key encryption modes
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-07
**Success Criteria** (what must be TRUE):
  1. User can generate a P-256 keypair and receive it in COSE_Key format
  2. User can encrypt a message to a single recipient using integrated encryption (COSE_Encrypt0)
  3. User can encrypt a message to multiple recipients using key encryption (COSE_Encrypt)
  4. User can decrypt messages from both encryption modes using their private key
  5. User can view any key in CDDL diagnostic notation
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md - Project setup with types, CBOR encoding, and COSE_Key structures
- [x] 01-02-PLAN.md - HPKE-7 integration with integrated and key encryption modes

### Phase 2: CLI
**Goal**: Users can perform all cryptographic operations from the command line
**Depends on**: Phase 1
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07
**Success Criteria** (what must be TRUE):
  1. User can run `keygen` command and receive a keypair displayed in diagnostic notation
  2. User can run `encrypt` command and receive a shareable URL containing the encrypted message
  3. User can run `encrypt --output file.cose` and save encrypted message to a file
  4. User can run `decrypt` command with either a URL or file path and see decrypted plaintext
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md - CLI setup with citty framework and keygen command
- [x] 02-02-PLAN.md - Encrypt and decrypt commands with URL/file I/O

### Phase 3: URL Transport
**Goal**: Encrypted messages can be efficiently transported in URL fragments
**Depends on**: Phase 1
**Requirements**: URL-01, URL-02, URL-03, URL-04
**Success Criteria** (what must be TRUE):
  1. Encrypted COSE message is compressed via CompressionStream before URL encoding
  2. Compressed data is encoded as base64url (no padding) and placed in URL fragment
  3. URL fragment can be decoded, decompressed, and decrypted to recover original plaintext
  4. Fragment data never appears in URL path (verified by inspecting generated URLs)
**Plans**: 1 plan

Plans:
- [ ] 03-01-PLAN.md - Compression library module, CLI integration, and URL transport tests

### Phase 4: Web Demo
**Goal**: Users can encrypt and decrypt messages entirely in the browser via a GitHub Pages demo
**Depends on**: Phase 1, Phase 3
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08
**Success Criteria** (what must be TRUE):
  1. User can generate a keypair in the browser and see it displayed
  2. User can save public and private keys with names to localStorage
  3. User can select a saved recipient key, enter plaintext, and generate a shareable URL
  4. User can open a URL with encrypted fragment and see decrypted message (using key from localStorage)
  5. Demo is accessible via GitHub Pages URL
**Plans**: TBD (1-3 plans)

Plans:
- [ ] 04-01: Browser bundle and key management UI
- [ ] 04-02: Encrypt/decrypt pages with URL fragment handling
- [ ] 04-03: GitHub Pages deployment

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | 2026-01-19 |
| 2. CLI | 2/2 | Complete | 2026-01-19 |
| 3. URL Transport | 0/1 | Planned | - |
| 4. Web Demo | 0/3 | Not started | - |

---
*Roadmap created: 2026-01-19*
*Phase 1 planned: 2026-01-19*
*Phase 2 planned: 2026-01-19*
*Phase 3 planned: 2026-01-19*
*Depth: quick (4 phases)*
