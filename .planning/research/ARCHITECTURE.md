# Architecture Patterns

**Domain:** COSE-HPKE Library (draft-ietf-cose-hpke-20)
**Researched:** 2026-01-19
**Confidence:** HIGH (based on RFC specifications, established library patterns)

## Recommended Architecture

```
+-------------------------------------------------------------+
|                        Applications                          |
+-------------------------------------------------------------+
|  CLI (Bun)                    |  Web Demo (GitHub Pages)    |
|  - keygen                     |  - Encrypt page             |
|  - encrypt                    |  - Decrypt page             |
|  - decrypt                    |  - Key management UI        |
+-------------------------------------------------------------+
                               |
+-------------------------------------------------------------+
|                      Public API Layer                        |
+-------------------------------------------------------------+
|  cose-hpke/api                                              |
|  - encrypt(plaintext, recipientKeys, opts) -> COSE message  |
|  - decrypt(coseMessage, privateKey) -> plaintext            |
|  - generateKeyPair(suite) -> COSE_Key pair                  |
|  - serializeKey/parseKey -> COSE_Key <-> binary             |
+-------------------------------------------------------------+
                               |
+-------------------------------------------------------------+
|                     COSE Structure Layer                     |
+-------------------------------------------------------------+
|  cose-hpke/cose                                             |
|  - COSE_Encrypt0 (integrated encryption, single recipient)  |
|  - COSE_Encrypt (key encryption, multiple recipients)       |
|  - COSE_Key (key representation)                            |
|  - Header management (protected/unprotected buckets)        |
+-------------------------------------------------------------+
                               |
+-------------------------------------------------------------+
|                      HPKE Core Layer                         |
+-------------------------------------------------------------+
|  hpke-js (external)                                         |
|  - CipherSuite composition                                  |
|  - Seal/Open operations                                     |
|  - Key encapsulation (enc value)                            |
+-------------------------------------------------------------+
                               |
+-------------------------------------------------------------+
|                    Serialization Layer                       |
+-------------------------------------------------------------+
|  cbor2 (external)           |  Diagnostic Formatter         |
|  - CBOR encode/decode       |  - CDDL/EDN notation          |
|  - Tag handling (96, 97)    |  - Human-readable display     |
+-------------------------------------------------------------+
                               |
+-------------------------------------------------------------+
|                   Cryptographic Primitives                   |
+-------------------------------------------------------------+
|  Web Crypto API             |  @noble/curves (or via hpke)  |
|  - P-256 ECDH               |  - X25519                     |
|  - AES-256-GCM              |  - ChaCha20Poly1305           |
|  - HKDF-SHA256              |                               |
+-------------------------------------------------------------+
```

## Component Boundaries

| Component | Responsibility | Exposes | Depends On |
|-----------|---------------|---------|------------|
| **CLI** | User commands, file I/O, URL generation | Commands: keygen, encrypt, decrypt | Public API, Key Storage |
| **Web Demo** | Browser UI, URL fragment handling, localStorage | Encrypt/decrypt pages, key management | Public API, Key Storage |
| **Public API** | High-level encrypt/decrypt operations | `encrypt()`, `decrypt()`, `generateKeyPair()` | COSE Layer, HPKE Core |
| **COSE Layer** | COSE message construction, header management | `COSE_Encrypt0`, `COSE_Encrypt`, `COSE_Key` builders | Serialization, HPKE Core |
| **HPKE Core** | RFC 9180 HPKE operations | `CipherSuite`, `seal()`, `open()` | Crypto Primitives |
| **Serialization** | CBOR encode/decode, diagnostic notation | `encode()`, `decode()`, `toDiagnostic()` | cbor2 library |
| **Key Storage** | Key persistence (file/localStorage) | `saveKey()`, `loadKey()`, `listKeys()` | Serialization |
| **Crypto Primitives** | Low-level cryptographic operations | Web Crypto API, noble/curves | None (platform) |

## Data Flow

### Encryption Flow (Integrated Mode - COSE_Encrypt0)

```
Plaintext
    |
    v
[Compress] (optional, via CompressionStream)
    |
    v
[HPKE Seal]
    |-- Input: plaintext, recipientPublicKey, AAD (protected header)
    |-- Output: (enc, ciphertext)
    |
    v
[Build COSE_Encrypt0]
    |-- Protected header: { alg: HPKE-4 or HPKE-7 }
    |-- Unprotected header: { ek: enc }  <-- encapsulated key
    |-- Ciphertext
    |
    v
[CBOR Encode]
    |-- Apply COSE_Encrypt0 tag (16)
    |
    v
[Base64url Encode] (for URL)
    |
    v
URL: https://demo.site/#<base64url-encoded-message>
```

### Encryption Flow (Key Encryption Mode - COSE_Encrypt)

```
Plaintext
    |
    v
[Generate random CEK]
    |
    v
[Encrypt content with CEK] (layer 0)
    |-- AEAD encrypt using CEK
    |
    v
[For each recipient:]
    |
    [HPKE Seal CEK]
    |-- Input: CEK, recipientPublicKey, AAD
    |-- Output: (enc_i, encrypted_CEK_i)
    |
    v
[Build COSE_recipient]
    |-- Protected header: { alg: HPKE-4 or HPKE-7 }
    |-- Unprotected header: { ek: enc_i }
    |-- Encrypted CEK
    |
    v
[Build COSE_Encrypt]
    |-- Protected header: { alg: A256GCM (for layer 0) }
    |-- Unprotected header: {}
    |-- Ciphertext
    |-- Recipients array
    |
    v
[CBOR Encode] -> [Base64url] -> URL
```

### Decryption Flow

```
URL Fragment
    |
    v
[Base64url Decode]
    |
    v
[CBOR Decode]
    |-- Parse COSE_Encrypt0 or COSE_Encrypt
    |-- Extract protected/unprotected headers
    |
    v
[Extract enc from 'ek' header]
    |
    v
[HPKE Open]
    |-- Integrated: decrypt ciphertext directly
    |-- Key Encryption: decrypt CEK, then use CEK to decrypt content
    |
    v
[Decompress] (if compressed)
    |
    v
Plaintext
```

### Key Generation Flow

```
[Select cipher suite]
    |-- HPKE-4: X25519 + HKDF-SHA256 + ChaCha20Poly1305
    |-- HPKE-7: P-256 + HKDF-SHA256 + AES-256-GCM
    |
    v
[Generate HPKE keypair]
    |-- For X25519: @noble/curves or hpke-js internal
    |-- For P-256: Web Crypto API
    |
    v
[Build COSE_Key structures]
    |
    |-- Public key (kty: OKP/EC2, crv, x, [y])
    |-- Private key (kty: OKP/EC2, crv, x, [y], d)
    |
    v
[Serialize to CBOR]
    |
    v
[Store]
    |-- CLI: file system (CBOR binary or diagnostic)
    |-- Web: localStorage (base64 encoded CBOR)
```

## COSE Message Structures

### COSE_Encrypt0 (Tag 16)

```cddl
COSE_Encrypt0 = [
    protected: bstr,        ; CBOR-encoded protected header
    unprotected: header_map,
    ciphertext: bstr / nil
]

; For HPKE:
protected = { 1: algorithm }  ; alg in protected (REQUIRED)
unprotected = { -4: bstr }    ; ek (encapsulated key)
```

### COSE_Encrypt (Tag 96)

```cddl
COSE_Encrypt = [
    protected: bstr,
    unprotected: header_map,
    ciphertext: bstr / nil,
    recipients: [+ COSE_recipient]
]

COSE_recipient = [
    protected: bstr,
    unprotected: header_map,
    ciphertext: bstr / nil    ; encrypted CEK
]
```

### COSE_Key

```cddl
COSE_Key = {
    1 => kty,           ; Key type (OKP=1, EC2=2)
    ? 2 => kid,         ; Key identifier (optional)
    ? 3 => alg,         ; Algorithm restriction (optional)
    -1 => crv,          ; Curve (X25519=4, P-256=1)
    -2 => x,            ; X coordinate
    ? -3 => y,          ; Y coordinate (EC2 only)
    ? -4 => d           ; Private key (private keys only)
}
```

## Cipher Suite Configuration

| Suite | Algorithm ID | KEM | KDF | AEAD | Use Case |
|-------|-------------|-----|-----|------|----------|
| HPKE-4 | 4 | DHKEM(X25519) | HKDF-SHA256 | ChaCha20Poly1305 | Modern, fast, no Web Crypto |
| HPKE-7 | 7 | DHKEM(P-256) | HKDF-SHA256 | AES-256-GCM | NIST-approved, Web Crypto native |

## Module Organization

```
src/
  index.ts              # Public API exports

  core/
    cipher-suite.ts     # HPKE cipher suite abstraction
    encrypt.ts          # High-level encrypt operations
    decrypt.ts          # High-level decrypt operations
    keygen.ts           # Key generation

  cose/
    encrypt0.ts         # COSE_Encrypt0 builder/parser
    encrypt.ts          # COSE_Encrypt builder/parser
    recipient.ts        # COSE_recipient structure
    key.ts              # COSE_Key builder/parser
    headers.ts          # Protected/unprotected header handling
    tags.ts             # CBOR tag constants

  serialization/
    cbor.ts             # CBOR encode/decode wrapper
    diagnostic.ts       # CDDL/EDN diagnostic notation
    base64url.ts        # Base64url encoding

  storage/
    types.ts            # Key storage interface
    file.ts             # File-based storage (CLI)
    local.ts            # localStorage storage (Web)

  compression/
    streams.ts          # CompressionStream/DecompressionStream wrapper

  types/
    index.ts            # Shared TypeScript types
    cose.ts             # COSE-specific types
    hpke.ts             # HPKE-specific types

cli/
  index.ts              # CLI entry point
  commands/
    keygen.ts           # Key generation command
    encrypt.ts          # Encryption command
    decrypt.ts          # Decryption command

web/
  index.html            # Demo landing page
  encrypt.html          # Encryption page
  decrypt.html          # Decryption page (reads fragment)
  js/
    app.ts              # Main application logic
    keys.ts             # Key management UI
    url.ts              # URL fragment handling
```

## Patterns to Follow

### Pattern 1: Cipher Suite Abstraction

**What:** Encapsulate HPKE algorithm selection behind a unified interface.
**When:** All encryption/decryption operations.
**Why:** Allows swapping cipher suites without changing business logic.

```typescript
interface CipherSuiteConfig {
  id: number;           // COSE algorithm ID (4 or 7)
  kem: KemId;
  kdf: KdfId;
  aead: AeadId;
}

const SUITES: Record<number, CipherSuiteConfig> = {
  4: { id: 4, kem: KemId.DhkemX25519HkdfSha256, kdf: KdfId.HkdfSha256, aead: AeadId.Chacha20Poly1305 },
  7: { id: 7, kem: KemId.DhkemP256HkdfSha256, kdf: KdfId.HkdfSha256, aead: AeadId.Aes256Gcm },
};

function getCipherSuite(algId: number): CipherSuite {
  const config = SUITES[algId];
  if (!config) throw new Error(`Unsupported algorithm: ${algId}`);
  return new CipherSuite({ kem: config.kem, kdf: config.kdf, aead: config.aead });
}
```

### Pattern 2: Builder Pattern for COSE Structures

**What:** Use builders to construct complex COSE messages.
**When:** Creating COSE_Encrypt0, COSE_Encrypt, COSE_Key.
**Why:** Enforces required fields, makes optional fields clear.

```typescript
class Encrypt0Builder {
  private protectedHeader: Map<number, unknown> = new Map();
  private unprotectedHeader: Map<number, unknown> = new Map();
  private ciphertext?: Uint8Array;

  algorithm(alg: number): this {
    this.protectedHeader.set(1, alg);
    return this;
  }

  encapsulatedKey(enc: Uint8Array): this {
    this.unprotectedHeader.set(-4, enc);
    return this;
  }

  payload(ct: Uint8Array): this {
    this.ciphertext = ct;
    return this;
  }

  build(): COSE_Encrypt0 {
    if (!this.protectedHeader.has(1)) throw new Error('Algorithm required');
    if (!this.unprotectedHeader.has(-4)) throw new Error('Encapsulated key required');
    if (!this.ciphertext) throw new Error('Ciphertext required');
    return { protected: this.protectedHeader, unprotected: this.unprotectedHeader, ciphertext: this.ciphertext };
  }
}
```

### Pattern 3: AAD from Protected Header

**What:** Use CBOR-encoded protected header as Additional Authenticated Data (AAD).
**When:** All HPKE Seal/Open operations.
**Why:** RFC requirement - protects header integrity.

```typescript
function encrypt(plaintext: Uint8Array, recipientPubKey: CryptoKey, alg: number): COSE_Encrypt0 {
  const protectedHeader = new Map([[1, alg]]);
  const encodedProtected = cbor.encode(protectedHeader);

  // AAD = Enc_structure for COSE
  const aad = cbor.encode(['Encrypt0', encodedProtected, new Uint8Array()]);

  const suite = getCipherSuite(alg);
  const { enc, ciphertext } = suite.seal(plaintext, recipientPubKey, aad);

  return { protected: protectedHeader, unprotected: new Map([[-4, enc]]), ciphertext };
}
```

### Pattern 4: Storage Interface Abstraction

**What:** Abstract key storage behind an interface for CLI vs Web.
**When:** Persisting and retrieving keys.
**Why:** Same codebase works in Bun (files) and browser (localStorage).

```typescript
interface KeyStorage {
  save(name: string, key: COSE_Key): Promise<void>;
  load(name: string): Promise<COSE_Key | null>;
  list(): Promise<string[]>;
  delete(name: string): Promise<void>;
}

class FileKeyStorage implements KeyStorage { /* Bun file system */ }
class LocalStorageKeyStorage implements KeyStorage { /* Browser localStorage */ }
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Exposing Raw Crypto Primitives

**What:** Letting application code directly call Web Crypto or hpke-js.
**Why bad:** Bypasses COSE structure requirements, easy to forget AAD, header integrity.
**Instead:** All operations go through the Public API layer.

### Anti-Pattern 2: Mixing Serialization Concerns

**What:** Putting CBOR encoding inside COSE structure classes.
**Why bad:** Tight coupling, hard to add diagnostic notation output.
**Instead:** COSE layer produces structured data; Serialization layer encodes it.

### Anti-Pattern 3: Hardcoding Key Storage Location

**What:** Direct `localStorage.setItem()` or `fs.writeFile()` in core code.
**Why bad:** Core library becomes platform-specific.
**Instead:** Inject `KeyStorage` interface; implementations are platform-specific.

### Anti-Pattern 4: Mutable COSE Structures

**What:** Allowing modification of COSE messages after construction.
**Why bad:** Protected header must be integrity-protected; changes invalidate AAD.
**Instead:** COSE structures are immutable after `build()`.

### Anti-Pattern 5: Storing Private Keys as Extractable

**What:** Setting `extractable: true` on CryptoKey objects for private keys.
**Why bad:** Increases attack surface for XSS.
**Instead:** Use `extractable: false` for Web Crypto keys when possible. Note: This limits portability but improves security. For localStorage keys, this is a tradeoff - you need extractable keys for serialization.

## Build Order (Dependencies)

Based on component dependencies, the recommended build order is:

```
Phase 1: Foundation
+-- types/           # TypeScript type definitions
+-- serialization/   # CBOR, base64url (depends on: cbor2)
+-- compression/     # CompressionStream wrapper (depends on: nothing)

Phase 2: COSE Structures
+-- cose/key.ts      # COSE_Key (depends on: serialization, types)
+-- cose/headers.ts  # Header handling (depends on: serialization)
+-- cose/encrypt0.ts # COSE_Encrypt0 (depends on: headers, serialization)
+-- cose/encrypt.ts  # COSE_Encrypt (depends on: encrypt0, headers)

Phase 3: HPKE Integration
+-- core/cipher-suite.ts  # Cipher suite config (depends on: hpke-js)
+-- core/keygen.ts        # Key generation (depends on: cipher-suite, cose/key)
+-- core/encrypt.ts       # Encryption (depends on: cipher-suite, cose/*, compression)
+-- core/decrypt.ts       # Decryption (depends on: cipher-suite, cose/*, compression)

Phase 4: Storage & Public API
+-- storage/         # Key storage (depends on: cose/key, serialization)
+-- index.ts         # Public API (depends on: core/*, cose/*)
+-- diagnostic.ts    # CDDL notation (depends on: cose/*)

Phase 5: Applications
+-- cli/             # CLI commands (depends on: public API, storage/file)
+-- web/             # Web demo (depends on: public API, storage/local)
```

### Critical Path

1. **Serialization must come first** - everything depends on CBOR encode/decode
2. **COSE structures before HPKE integration** - need structures to build messages
3. **Core encryption before applications** - CLI/Web are consumers
4. **Storage can parallelize with Phase 3** - independent of encryption logic

## Scalability Considerations

| Concern | Small Messages | Large Messages (>1MB) | Streaming |
|---------|---------------|----------------------|-----------|
| Memory | Load entire message | Use streaming compression | Required |
| Compression | `deflate-raw` | `gzip` with streaming | CompressionStream |
| URL Length | Direct fragment | Consider file upload | Not applicable |
| Key Management | localStorage | IndexedDB | IndexedDB |

**URL Fragment Limits:**
- Chrome: ~2MB URL length (entire URL, not just fragment)
- Safari: ~80KB practical limit
- **Recommendation:** Warn users at 50KB, suggest file download at 100KB

## Integration Points

### CLI Integration

```typescript
// CLI entry points
import { encrypt, decrypt, generateKeyPair } from 'cose-hpke';
import { FileKeyStorage } from 'cose-hpke/storage/file';

const storage = new FileKeyStorage('~/.cose-hpke/keys');

// keygen command
const { publicKey, privateKey } = await generateKeyPair(4); // HPKE-4
await storage.save('mykey', privateKey);
console.log(toDiagnostic(publicKey)); // CDDL notation

// encrypt command
const message = await encrypt(plaintext, recipientPublicKey, { algorithm: 4 });
const url = `https://demo.example.com/#${base64url(message)}`;
console.log(url);
```

### Web Demo Integration

```typescript
// Web decrypt page
import { decrypt, parseCOSEKey } from 'cose-hpke';
import { LocalStorageKeyStorage } from 'cose-hpke/storage/local';

const fragment = window.location.hash.slice(1);
if (fragment) {
  const message = base64urlDecode(fragment);
  const storage = new LocalStorageKeyStorage();
  const privateKey = await storage.load('default');
  if (privateKey) {
    const plaintext = await decrypt(message, privateKey);
    displayMessage(plaintext);
  }
}
```

## Sources

### Specifications
- [RFC 9180 - Hybrid Public Key Encryption](https://datatracker.ietf.org/doc/rfc9180/)
- [RFC 9052 - COSE: Structures and Process](https://datatracker.ietf.org/doc/rfc9052/)
- [RFC 9053 - COSE: Initial Algorithms](https://www.rfc-editor.org/rfc/rfc9053.html)
- [draft-ietf-cose-hpke - HPKE with COSE](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/)
- [RFC 8610 - CDDL](https://datatracker.ietf.org/doc/html/rfc8610)

### Libraries
- [hpke-js](https://github.com/dajiaji/hpke-js) - TypeScript HPKE implementation
- [@ldclabs/cose-ts](https://github.com/ldclabs/cose-ts) - TypeScript COSE library (reference)
- [cbor2](https://github.com/hildjj/cbor2) - CBOR library for JavaScript

### Patterns
- [Excalidraw E2E Encryption](https://plus.excalidraw.com/blog/end-to-end-encryption) - URL fragment encryption pattern
- [Compression Streams API](https://developer.chrome.com/blog/compression-streams-api/) - Web Streams compression
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) - Browser crypto primitives
- [Storing Cryptographic Keys in Browser](https://pomcor.com/2017/06/02/keys-in-browser/) - Key storage patterns
