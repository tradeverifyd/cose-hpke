# Phase 1: Foundation - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Core library with COSE structures and HPKE-7 encryption. Users can generate P-256 keypairs and encrypt/decrypt messages using integrated encryption (COSE_Encrypt0) for single recipient and key encryption (COSE_Encrypt) for multiple recipients. This phase delivers the cryptographic foundation — CLI and URL transport are separate phases.

</domain>

<decisions>
## Implementation Decisions

### API Surface
- Function-based API (standalone functions, not classes): generateKeyPair(), encrypt(), decrypt()
- All functions return Promises (consistent async pattern, required for WebCrypto)
- Encryption functions return CBOR-encoded Uint8Array (ready-to-transmit format)
- Multi-recipient encrypt takes array of public keys directly: encrypt(plaintext, [pubKey1, pubKey2])

### Key Format
- generateKeyPair() returns { publicKey, privateKey } as separate COSE_Key structures
- Keys stored internally as CBOR-encoded Uint8Array (decode when needed)
- Separate toDiagnostic(coseBytes) function for CDDL diagnostic notation output
- Include JWK conversion helpers: fromJwk() and toJwk() for interoperability

### Error Handling
- Custom error classes: CoseError, DecryptionError, InvalidKeyError (typed exceptions)
- Decrypt attempts all recipients before failing (better for multi-recipient scenarios)
- Developer-friendly verbose error messages (include context: which key failed, expected vs actual)
- Malformed input always throws (never silent failure, no undefined returns)

### Multi-recipient Design
- Automatic format selection: 1 recipient → COSE_Encrypt0, 2+ → COSE_Encrypt
- Single decrypt() function auto-detects message format via CBOR tag inspection
- API designed for future mixed key types, but v1 only implements P-256

### Claude's Discretion
- Internal code organization and module structure
- Specific error class hierarchy
- CBOR library wrapper patterns
- Test structure and coverage approach

</decisions>

<specifics>
## Specific Ideas

- API should feel familiar to developers who've used jose or similar JWT/JWE libraries
- Diagnostic notation output should match CDDL examples from the COSE-HPKE draft for easy verification

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-01-19*
