# Phase 1: Foundation - Research

**Researched:** 2026-01-19
**Domain:** COSE-HPKE Core Library (TypeScript/Bun)
**Confidence:** HIGH

## Summary

Phase 1 delivers the cryptographic foundation: COSE_Key format handling, HPKE-7 encryption/decryption (P-256 + AES-256-GCM), and both integrated (COSE_Encrypt0) and key encryption (COSE_Encrypt) modes. The implementation uses **@panva/hpke** for HPKE operations and **cbor2** for CBOR encoding with diagnostic notation support.

The CONTEXT.md decisions lock in a function-based API (`generateKeyPair()`, `encrypt()`, `decrypt()`), CBOR-encoded Uint8Array outputs, and automatic format selection (1 recipient = COSE_Encrypt0, 2+ = COSE_Encrypt). Research confirms these decisions align well with the underlying library APIs.

**Primary recommendation:** Build bottom-up starting with types and CBOR utilities, then COSE structures (COSE_Key, headers, COSE_Encrypt0, COSE_Encrypt), then HPKE integration. This ordering ensures each layer has stable dependencies.

## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **@panva/hpke** | ^1.0.0 | HPKE operations (Seal/Open) | Zero deps, WebCrypto-based, explicit Bun support, tree-shakeable ESM |
| **cbor2** | ^2.0.1 | CBOR encoding/decoding | Modern web-first design, `diagnose()` for diagnostic notation, node-cbor maintainer's recommended successor |
| **TypeScript** | ^5.7 | Type safety | Industry standard, required for type-safe COSE structures |
| **Bun** | ^1.3.3+ | Runtime/test runner | Native TypeScript, fast, unified toolchain |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **bun:test** | (built-in) | Testing | Jest-compatible API, fast TypeScript support |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @panva/hpke | hpke-js (@dajiaji) | More modular but same underlying patterns; @panva has simpler API |
| cbor2 | cbor-x | Faster but lacks built-in diagnostic notation |
| cbor2 | cborg | Stricter determinism options but different API style |

**Installation:**
```bash
bun add hpke cbor2
bun add -d typescript @types/bun
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  index.ts              # Public API exports
  types/
    cose.ts             # COSE type definitions (COSE_Key, headers, etc.)
    hpke.ts             # HPKE-related types
  cose/
    key.ts              # COSE_Key builder/parser
    headers.ts          # Protected/unprotected header handling
    encrypt0.ts         # COSE_Encrypt0 structure
    encrypt.ts          # COSE_Encrypt structure (multi-recipient)
    recipient.ts        # COSE_recipient structure
    aad.ts              # Enc_structure AAD construction
  hpke/
    suite.ts            # Cipher suite configuration (HPKE-7)
    integrated.ts       # Integrated encryption mode
    key-encryption.ts   # Key encryption mode
  util/
    cbor.ts             # CBOR encode/decode wrapper
    diagnostic.ts       # CDDL diagnostic notation
    base64url.ts        # Base64url encoding
  errors.ts             # Custom error classes
test/
  *.test.ts             # Test files
```

### Pattern 1: COSE_Key as CBOR-encoded Uint8Array

**What:** Keys are stored and passed as CBOR-encoded Uint8Array, decoded only when needed for crypto operations.
**When to use:** All key storage, serialization, and API boundaries.
**Why:** Aligns with CONTEXT.md decision, avoids repeated serialization, maintains binary format.

```typescript
// Source: CONTEXT.md decision
interface KeyPair {
  publicKey: Uint8Array;   // CBOR-encoded COSE_Key
  privateKey: Uint8Array;  // CBOR-encoded COSE_Key with 'd' parameter
}

async function generateKeyPair(): Promise<KeyPair> {
  const suite = new CipherSuite(KEM_DHKEM_P256_HKDF_SHA256, KDF_HKDF_SHA256, AEAD_AES_256_GCM);
  const { publicKey, privateKey } = await suite.GenerateKeyPair();

  // Convert CryptoKey to COSE_Key and encode
  return {
    publicKey: encodeCoseKey(await exportPublicKey(publicKey)),
    privateKey: encodeCoseKey(await exportPrivateKey(privateKey)),
  };
}
```

### Pattern 2: Enc_structure for AAD Construction

**What:** Build the Enc_structure CBOR array for authenticated data per RFC 9052 Section 5.3.
**When to use:** Every HPKE Seal/Open operation.
**Why:** Required by COSE specification for header integrity protection.

```typescript
// Source: RFC 9052 Section 5.3
// Enc_structure = [context, protected, external_aad]

function buildEncStructure(
  context: 'Encrypt0' | 'Encrypt',
  protectedHeader: Uint8Array,
  externalAad: Uint8Array = new Uint8Array()
): Uint8Array {
  return encode([context, protectedHeader, externalAad]);
}

// For COSE_Encrypt0 (integrated encryption):
const aad = buildEncStructure('Encrypt0', encodedProtectedHeader);

// For COSE_Encrypt content layer:
const aad = buildEncStructure('Encrypt', encodedProtectedHeader);
```

### Pattern 3: Automatic Format Selection

**What:** Single encrypt() function that chooses COSE_Encrypt0 or COSE_Encrypt based on recipient count.
**When to use:** Public API layer.
**Why:** Per CONTEXT.md decision - simplifies API, matches natural usage patterns.

```typescript
// Source: CONTEXT.md decision
async function encrypt(
  plaintext: Uint8Array,
  recipients: Uint8Array[]  // Array of COSE_Key public keys
): Promise<Uint8Array> {
  if (recipients.length === 0) {
    throw new InvalidKeyError('At least one recipient required');
  }

  if (recipients.length === 1) {
    return encryptIntegrated(plaintext, recipients[0]);
  }

  return encryptKeyEncryption(plaintext, recipients);
}
```

### Pattern 4: CBOR Tag Usage

**What:** Apply correct CBOR tags to COSE structures for interoperability.
**When to use:** When encoding final COSE messages.
**Why:** Tags identify structure type (16 for COSE_Encrypt0, 96 for COSE_Encrypt).

```typescript
// COSE structure tags
const COSE_ENCRYPT0_TAG = 16;  // Single recipient
const COSE_ENCRYPT_TAG = 96;   // Multi-recipient

// Using cbor2 Tag class
import { encode, Tag } from 'cbor2';

function encodeCoseEncrypt0(structure: CoseEncrypt0): Uint8Array {
  return encode(new Tag(COSE_ENCRYPT0_TAG, [
    structure.protectedHeader,
    structure.unprotectedHeader,
    structure.ciphertext
  ]));
}
```

### Anti-Patterns to Avoid

- **Storing CryptoKey objects:** CryptoKey is runtime-specific; always serialize to COSE_Key format
- **Skipping AAD construction:** Missing Enc_structure enables header manipulation attacks
- **Reusing HPKE contexts:** Creates nonce collision, catastrophic security failure
- **Manual CBOR integer encoding:** Let cbor2 handle encoding; don't hand-roll CBOR bytes
- **Exposing raw HPKE API:** All operations should go through COSE layer for proper header handling

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CBOR encoding | Manual byte arrays | cbor2.encode() | Edge cases with integers, maps, tags |
| HPKE operations | Custom EC/AEAD | @panva/hpke | Audited, handles context correctly |
| Base64url | String manipulation | Built-in or small utility | Padding edge cases |
| Key coordinate extraction | Manual CryptoKey parsing | WebCrypto exportKey('jwk') | Platform-specific internals |
| Diagnostic notation | String formatting | cbor2.diagnose() | Handles all CBOR types correctly |

**Key insight:** COSE and HPKE have precise specification requirements. Hand-rolling any crypto or encoding inevitably misses edge cases that cause interoperability failures.

## Common Pitfalls

### Pitfall 1: HPKE Context Reuse

**What goes wrong:** Reusing HPKE context for multiple Seal() operations causes nonce collision, completely breaking AEAD security.
**Why it happens:** Developers cache contexts for performance, not realizing HPKE is stateful.
**How to avoid:** Create fresh CipherSuite and call Seal() once per encryption. Never store context objects.
**Warning signs:** Same `enc` (encapsulated key) value appearing in multiple messages.

### Pitfall 2: Non-Deterministic CBOR Encoding

**What goes wrong:** Different CBOR encodings for same data break signature verification and hash comparison.
**Why it happens:** CBOR allows multiple valid encodings (integer sizes, map key ordering).
**How to avoid:** cbor2 produces consistent output by default. Test encoding stability across runs.
**Warning signs:** Hash mismatches when encoding same COSE_Key twice.

### Pitfall 3: Missing AAD (Enc_structure)

**What goes wrong:** Not binding protected header to AEAD's AAD enables header manipulation attacks.
**Why it happens:** Focus on plaintext encryption, forgetting COSE requires specific Enc_structure.
**How to avoid:** Always construct Enc_structure per RFC 9052 Section 5.3 before Seal/Open.
**Warning signs:** Modified protected header doesn't cause decryption failure.

### Pitfall 4: EC2/OKP Parameter Confusion

**What goes wrong:** Mixing up COSE_Key parameters between EC2 (P-256) and OKP (X25519) key types.
**Why it happens:** Same parameter labels (-2, -3, -4) but different meanings per key type.
**How to avoid:** Always check kty (key type) first. Use separate code paths for EC2 vs OKP.
**Warning signs:** Key import failures, silent crypto errors.

### Pitfall 5: Wrong Algorithm ID for Mode

**What goes wrong:** Using integrated encryption algorithm ID (45) in key encryption mode (needs 53).
**Why it happens:** COSE-HPKE defines distinct IDs per mode but they're easy to confuse.
**How to avoid:** Define separate constants for HPKE_7_INTEGRATED (45) and HPKE_7_KEY_ENCRYPTION (53).
**Warning signs:** Interoperability failures with other implementations.

## Code Examples

Verified patterns from official sources:

### COSE_Key Structure for P-256 (EC2)

```typescript
// Source: RFC 9053 Section 7.1
// COSE_Key for EC2 (P-256) public key

interface CoseKeyEC2 {
  1: 2;        // kty: EC2
  [-1]: 1;     // crv: P-256
  [-2]: Uint8Array;  // x coordinate
  [-3]: Uint8Array;  // y coordinate
  [-4]?: Uint8Array; // d (private key only)
}

// Encoding with cbor2
import { encode, decode } from 'cbor2';

function encodeCoseKey(key: CoseKeyEC2): Uint8Array {
  const map = new Map<number, unknown>();
  map.set(1, 2);     // kty = EC2
  map.set(-1, 1);    // crv = P-256
  map.set(-2, key[-2]); // x
  map.set(-3, key[-3]); // y
  if (key[-4]) {
    map.set(-4, key[-4]); // d (private key)
  }
  return encode(map);
}
```

### COSE_Encrypt0 Structure

```typescript
// Source: RFC 9052 Section 5.2, draft-ietf-cose-hpke-20
// COSE_Encrypt0 = [protected, unprotected, ciphertext]

interface CoseEncrypt0 {
  protected: Uint8Array;      // CBOR-encoded protected header
  unprotected: Map<number, unknown>;  // Unprotected header map
  ciphertext: Uint8Array;
}

// Protected header for HPKE-7 integrated encryption
const protectedHeader = new Map<number, number>();
protectedHeader.set(1, 45);  // alg: HPKE-7 integrated (TBD13)

// Unprotected header with encapsulated key
const unprotectedHeader = new Map<number, Uint8Array>();
unprotectedHeader.set(-4, encapsulatedKey);  // ek parameter

// Full structure
const encrypt0: CoseEncrypt0 = {
  protected: encode(protectedHeader),
  unprotected: unprotectedHeader,
  ciphertext: ciphertext
};
```

### HPKE-7 Seal Operation

```typescript
// Source: @panva/hpke documentation
import * as HPKE from 'hpke';

// HPKE-7: P-256 + HKDF-SHA256 + AES-256-GCM
const suite = new HPKE.CipherSuite(
  HPKE.KEM_DHKEM_P256_HKDF_SHA256,
  HPKE.KDF_HKDF_SHA256,
  HPKE.AEAD_AES_256_GCM
);

// Generate recipient keypair
const recipient = await suite.GenerateKeyPair();

// Encrypt with AAD
const aad = buildEncStructure('Encrypt0', encodedProtectedHeader);
const { encapsulatedSecret, ciphertext } = await suite.Seal(
  recipient.publicKey,
  plaintext,
  aad
);

// encapsulatedSecret goes in 'ek' header parameter (-4)
// ciphertext goes in COSE_Encrypt0 ciphertext field
```

### Diagnostic Notation Output

```typescript
// Source: cbor2 documentation
import { diagnose } from 'cbor2';

function toDiagnostic(coseBytes: Uint8Array): string {
  return diagnose(coseBytes);
}

// Example output for COSE_Key:
// {1: 2, -1: 1, -2: h'65eda5a1...', -3: h'1e52ed75...'}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| COSE_KDF_Context for HPKE | Recipient_structure | draft-ietf-cose-hpke-20 | Must use "HPKE Recipient" context string |
| X25519 via WebCrypto | Library required (Bun) | Ongoing | Bun's X25519 deriveBits incomplete |
| Algorithm IDs 4/48 | IDs 42-53 per mode | draft-20 | Separate IDs for integrated vs key encryption |

**Deprecated/outdated:**
- Using COSE_KDF_Context with HPKE recipients (prohibited by spec)
- Assuming WebCrypto supports all HPKE algorithms in all runtimes

## Algorithm ID Reference

Per draft-ietf-cose-hpke-20 (values pending IANA assignment):

| Cipher Suite | Integrated Encryption | Key Encryption | Components |
|--------------|----------------------|----------------|------------|
| HPKE-7 | 45 (TBD13) | 53 (TBD21) | DHKEM(P-256) + HKDF-SHA256 + AES-256-GCM |

**Header Parameters:**
- `alg` (label 1): Algorithm identifier in protected header
- `ek` (label -4): Encapsulated key in unprotected header (bstr)
- `kid` (label 4): Key identifier (optional, recommended for recipient identification)

## COSE Structure Reference

### COSE_Encrypt0 (Tag 16)

```cddl
COSE_Encrypt0 = [
    protected: bstr,         ; CBOR-encoded map
    unprotected: header_map, ; Map with 'ek' parameter
    ciphertext: bstr
]

; For HPKE integrated encryption:
protected = { 1: 45 }    ; alg = HPKE-7 integrated
unprotected = { -4: enc } ; ek = encapsulated key
```

### COSE_Encrypt (Tag 96)

```cddl
COSE_Encrypt = [
    protected: bstr,
    unprotected: header_map,
    ciphertext: bstr,
    recipients: [+ COSE_recipient]
]

COSE_recipient = [
    protected: bstr,          ; { 1: 53 } for HPKE-7 key encryption
    unprotected: header_map,  ; { -4: enc_i }
    ciphertext: bstr          ; encrypted CEK
]
```

### COSE_Key (EC2 / P-256)

```cddl
COSE_Key_EC2 = {
    1 => 2,           ; kty: EC2
    -1 => 1,          ; crv: P-256
    -2 => bstr,       ; x coordinate (32 bytes)
    -3 => bstr,       ; y coordinate (32 bytes)
    ? -4 => bstr      ; d private key (32 bytes, private keys only)
}
```

## Open Questions

Things that couldn't be fully resolved:

1. **cbor2 deterministic encoding options**
   - What we know: cbor2 produces consistent output; has `dcbor` option mentioned in playground
   - What's unclear: Exact configuration options for RFC 8949 Section 4.2 deterministic encoding
   - Recommendation: Test encoding stability; cbor2 default behavior appears sufficient for COSE

2. **Algorithm ID finalization**
   - What we know: draft-ietf-cose-hpke-20 uses TBD placeholders with assumed values 35-53
   - What's unclear: When IANA will assign final values
   - Recommendation: Use assumed values (45 for HPKE-7 integrated, 53 for key encryption); make constants easy to update

3. **JWK conversion edge cases**
   - What we know: CONTEXT.md specifies fromJwk()/toJwk() helpers
   - What's unclear: Handling of optional JWK fields (kid, alg, use)
   - Recommendation: Convert core parameters (kty, crv, x, y, d); preserve kid if present

## Sources

### Primary (HIGH confidence)
- [RFC 9052 - COSE Structures](https://datatracker.ietf.org/doc/rfc9052/) - COSE_Encrypt0, headers, Enc_structure
- [RFC 9053 - COSE Algorithms](https://www.rfc-editor.org/rfc/rfc9053.html) - EC2 key parameters, P-256 curve value
- [draft-ietf-cose-hpke-20](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/) - COSE-HPKE integration, algorithm IDs, ek parameter
- [RFC 9180 - HPKE](https://www.rfc-editor.org/rfc/rfc9180.html) - HPKE operations, cipher suites
- [@panva/hpke GitHub](https://github.com/panva/hpke) - Library API, Seal/Open operations

### Secondary (MEDIUM confidence)
- [cbor2 GitHub](https://github.com/hildjj/cbor2) - CBOR encoding, diagnose() function
- [cbor2 Documentation](https://hildjj.github.io/cbor2/) - API reference

### Tertiary (LOW confidence)
- WebSearch results for cbor2 dcbor options - incomplete documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official library documentation verified
- Architecture: HIGH - Based on RFC patterns and CONTEXT.md decisions
- Pitfalls: HIGH - Verified against RFC security considerations
- Algorithm IDs: MEDIUM - Using TBD/assumed values from draft-20

**Research date:** 2026-01-19
**Valid until:** 60 days (stable specifications, draft-20 unlikely to change significantly)
