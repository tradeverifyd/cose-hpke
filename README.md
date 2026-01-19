# COSE-HPKE

End-to-end encrypted message sharing using HPKE with COSE serialization. Encrypted messages travel in URL fragments and are decrypted entirely client-side.

## Features

- **HPKE-7 Cipher Suite**: P-256 + HKDF-SHA256 + AES-256-GCM
- **COSE Serialization**: Standards-compliant CBOR Object Signing and Encryption
- **URL Fragment Transport**: Encrypted data in fragment (never sent to server)
- **Compression**: Automatic deflate compression for smaller URLs
- **Multi-recipient**: Encrypt to one (COSE_Encrypt0) or many (COSE_Encrypt) recipients
- **Browser Support**: Full client-side encryption/decryption

## Installation

```bash
bun add cose-hpke
```

## CLI Usage

### Generate Keypair

```bash
# Display keys in CDDL diagnostic notation
bun run cose-hpke keygen

# Save keys to files
bun run cose-hpke keygen --output-public alice.pub --output-private alice.key
```

### Encrypt

```bash
# Encrypt to a recipient (outputs shareable URL)
bun run cose-hpke encrypt "Hello, World!" -r alice.pub

# Encrypt to multiple recipients
bun run cose-hpke encrypt "Secret message" -r alice.pub -r bob.pub

# Save to file instead of URL
bun run cose-hpke encrypt "Hello" -r alice.pub -o message.cose
```

### Decrypt

```bash
# Decrypt from URL
bun run cose-hpke decrypt "https://example.com#..." -k alice.key

# Decrypt from file
bun run cose-hpke decrypt message.cose -k alice.key

# Decrypt from stdin
cat message.cose | bun run cose-hpke decrypt - -k alice.key
```

## Library API

```typescript
import {
  generateKeyPair,
  encrypt,
  decrypt,
  toDiagnostic,
  createShareableUrl,
  parseShareableUrl,
} from 'cose-hpke';

// Generate a keypair
const { publicKey, privateKey } = await generateKeyPair();

// View key in CDDL diagnostic notation
console.log(toDiagnostic(publicKey));
// {
//   1: 2,      / kty: EC2 /
//   -1: 1,     / crv: P-256 /
//   -2: h'...', / x /
//   -3: h'...', / y /
// }

// Encrypt a message
const plaintext = new TextEncoder().encode('Hello, World!');
const ciphertext = await encrypt(plaintext, [publicKey]);

// Create shareable URL
const url = await createShareableUrl(ciphertext);
// https://cose-hpke.github.io/decrypt#v1.eJz...

// Parse URL and decrypt
const received = await parseShareableUrl(url);
const decrypted = await decrypt(received, privateKey);
console.log(new TextDecoder().decode(decrypted));
// Hello, World!
```

### Key Conversion

```typescript
import { fromJwk, toJwk, coseKeyToCryptoKey } from 'cose-hpke';

// Import from JWK
const coseKey = fromJwk({
  kty: 'EC',
  crv: 'P-256',
  x: '...',
  y: '...',
});

// Export to JWK
const jwk = toJwk(publicKey);

// Convert to WebCrypto key
const cryptoKey = await coseKeyToCryptoKey(publicKey);
```

## Web Demo

A browser-based demo is available at the GitHub Pages URL. It allows you to:

1. Generate keypairs in the browser
2. Save keys to localStorage with friendly names
3. Encrypt messages to recipients
4. Share via QR code or URL
5. Decrypt messages from URL fragments

### Run locally

```bash
cd demo && python3 -m http.server 8000
# Open http://localhost:8000
```

## URL Transport Format

Encrypted messages are transported in URL fragments:

```
https://example.com/decrypt#v1.eJzLSM3JyQcABiwCFQ
                            ├──┘└─────────────────┘
                            │    Base64url encoded
                            │    deflate-compressed
                            │    COSE message
                            │
                            Version prefix (v1 = compressed)
```

The fragment is never sent to the server, ensuring end-to-end encryption.

## Technical Details

### Cipher Suite

| Component | Algorithm |
|-----------|-----------|
| KEM | DHKEM(P-256, HKDF-SHA256) |
| KDF | HKDF-SHA256 |
| AEAD | AES-256-GCM |
| COSE Algorithm ID | -1 (HPKE-7) |

### Message Formats

- **Single recipient**: COSE_Encrypt0 (tag 16) with integrated encryption
- **Multiple recipients**: COSE_Encrypt (tag 96) with key encryption

### Standards

- [RFC 9180](https://datatracker.ietf.org/doc/rfc9180/) - Hybrid Public Key Encryption
- [RFC 9052](https://datatracker.ietf.org/doc/rfc9052/) - CBOR Object Signing and Encryption
- [draft-ietf-cose-hpke](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/) - COSE HPKE

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build browser bundle
bun run build:demo
```

## License

MIT
