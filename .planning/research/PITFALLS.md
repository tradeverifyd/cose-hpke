# Domain Pitfalls: COSE-HPKE Implementation

**Domain:** Cryptographic library (COSE-HPKE with browser demo)
**Researched:** 2026-01-19
**Confidence:** HIGH (verified via official specs + multiple authoritative sources)

---

## Critical Pitfalls

Mistakes that cause security vulnerabilities, spec non-compliance, or require rewrites.

### Pitfall 1: HPKE Context Reuse (Nonce Collision)

**What goes wrong:** Reusing an HPKE context for multiple encryption operations causes nonce reuse, which completely breaks AEAD security. The same key-nonce pair encrypts different plaintexts, enabling trivial plaintext recovery.

**Why it happens:** HPKE is stateful - it tracks a sequence number for nonce generation. Developers may cache/reuse contexts for performance, not realizing each `Seal()` advances internal state. The COSE-HPKE spec explicitly states "multiple invocations of Open() / Seal() on the same context are not supported."

**Consequences:**
- Total loss of confidentiality
- Authentication bypass
- Catastrophic cryptographic failure

**Warning signs:**
- Code that stores HPKE context objects between requests
- Encryption functions that accept a pre-created context
- Unit tests that reuse context across multiple encrypt calls

**Prevention:**
- Create fresh HPKE context for every encryption operation
- Never expose context objects beyond single encrypt/decrypt scope
- Add test that verifies each encryption produces unique `enc` (ephemeral public key)

**Detection:** Encrypt same plaintext twice; if `enc` values are identical, context is being reused.

**Phase:** Core encryption implementation (Phase 1-2)

**Sources:** [RFC 9180 Section 9.7.1](https://www.rfc-editor.org/rfc/rfc9180.html), [draft-ietf-cose-hpke](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/)

---

### Pitfall 2: Bad Ephemeral Randomness

**What goes wrong:** Using weak or compromised random number generator for KEM encapsulation causes key-nonce reuse across different encryption operations, even when contexts are correctly not reused.

**Why it happens:**
- JavaScript `Math.random()` is not cryptographically secure
- Some environments have poor entropy sources
- Testing with deterministic seeds that leak into production

**Consequences:**
- Loss of confidentiality in Base mode
- Loss of forward secrecy in authenticated modes
- Same shared secret derived for different recipients

**Warning signs:**
- Using `Math.random()` anywhere in crypto code
- Not using `crypto.getRandomValues()` or equivalent
- Deterministic test modes without proper isolation

**Prevention:**
- Always use `crypto.getRandomValues()` (WebCrypto) or `crypto.randomBytes()` (Node/Bun)
- Follow [RFC 8937](https://www.rfc-editor.org/rfc/rfc8937.html) guidelines for random generation
- For testing, mock at the RNG level but never in production code paths

**Detection:** Generate 1000 keypairs/encryptions, check all `enc` values are unique.

**Phase:** Core crypto setup (Phase 1)

**Sources:** [RFC 9180 Section 9.3](https://www.rfc-editor.org/rfc/rfc9180.html), [RFC 8937](https://www.rfc-editor.org/rfc/rfc8937.html)

---

### Pitfall 3: Non-Constant-Time Tag Comparison

**What goes wrong:** Comparing AEAD authentication tags using standard string/buffer equality (e.g., `===` or `Buffer.equals()`) leaks timing information, enabling attackers to forge valid tags through repeated queries.

**Why it happens:** JavaScript's native comparison operators short-circuit on first mismatch. ChaCha20Poly1305 and AES-GCM produce 16-byte tags; timing differences across thousands of requests reveal correct tag bytes incrementally.

**Consequences:**
- Authentication bypass
- Message forgery
- Complete integrity compromise

**Warning signs:**
- Using `===` or `==` to compare authentication results
- Using `Buffer.compare()` or array comparison for tags
- Not using library-provided verification functions

**Prevention:**
- Use library-provided decrypt/verify functions that do constant-time comparison internally
- If manual comparison needed, use `crypto.timingSafeEqual()` (Node/Bun)
- Never implement tag extraction + comparison separately from decryption

**Detection:** Review decryption code for any manual tag handling.

**Phase:** Core decryption implementation (Phase 1-2)

**Sources:** [Timing Attacks in Node.js](https://dev.to/silentwatcher_95/timing-attacks-in-nodejs-4pmb), [libsodium AEAD docs](https://doc.libsodium.org/secret-key_cryptography/aead)

---

### Pitfall 4: Detached Ciphertext Without Integrity Protection

**What goes wrong:** In multi-recipient Key Encryption mode, using detached ciphertext without additional integrity protection leaves the bulk ciphertext unprotected, enabling modification attacks.

**Why it happens:** COSE supports detached ciphertext for payload flexibility. Developers assume HPKE's AEAD protects everything, but in Key Encryption mode, HPKE only protects the CEK, not the content ciphertext.

**Consequences:**
- Ciphertext manipulation attacks
- Integrity bypass
- Potential plaintext oracle attacks

**Warning signs:**
- Using `COSE_Encrypt` with empty ciphertext field
- Not adding `COSE_Sign`, `COSE_Mac`, or similar over detached content
- Missing `external_aad` in layer-0 encryption

**Prevention:**
- For this project, avoid detached ciphertext mode
- If detached is needed, always apply COSE_Sign or COSE_Mac over the full message
- Include detached ciphertext in `external_aad` for integrity binding

**Detection:** Review COSE structure for empty ciphertext with separate payload.

**Phase:** Multi-recipient implementation (if included)

**Sources:** [draft-ietf-cose-hpke Security Considerations](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/)

---

### Pitfall 5: Private Key Exposure via localStorage XSS

**What goes wrong:** Storing extractable private keys in localStorage exposes them to any XSS attack on the page origin. A single XSS vulnerability compromises all stored keys.

**Why it happens:** localStorage is convenient and persistent. Developers treat it like secure storage, not realizing any JavaScript on the same origin (including injected scripts, compromised dependencies, malicious browser extensions) can read it.

**Consequences:**
- Complete key compromise
- Attacker can decrypt all past and future messages
- No forensic evidence of key theft

**Warning signs:**
- Storing raw private key bytes in localStorage
- Not using Content Security Policy (CSP)
- Including third-party scripts without SRI (Subresource Integrity)
- No dependency auditing

**Prevention (defense in depth):**
1. Accept the risk explicitly in documentation - localStorage key storage is convenience vs. security tradeoff
2. Implement strict CSP: `script-src 'self'`
3. Use SRI for any external resources
4. Consider IndexedDB with non-extractable CryptoKey objects (WebCrypto)
5. Clear keys on logout/session end
6. Warn users about key storage risks in UI

**Detection:** Search codebase for `localStorage.setItem` with key material.

**Phase:** Key management and demo UI (Phase 3-4)

**Sources:** [Auth0: Secure Browser Storage](https://auth0.com/blog/secure-browser-storage-the-facts/), [Pomcor: Keys in Browser](https://pomcor.com/2017/06/02/keys-in-browser/)

---

### Pitfall 6: ChaCha20Poly1305 Not in WebCrypto

**What goes wrong:** Assuming WebCrypto provides ChaCha20Poly1305, then discovering at integration time it doesn't, requiring architecture changes to incorporate external library.

**Why it happens:** WebCrypto has X25519 and Ed25519 (as of 2025), so developers assume the full modern crypto suite. But ChaCha20Poly1305 was never added to the WebCrypto spec.

**Consequences:**
- HPKE-4 (X25519 + ChaCha20Poly1305) cannot use pure WebCrypto
- Must bundle JavaScript crypto library
- Larger bundle size, potential timing side-channels

**Warning signs:**
- Project plan assuming WebCrypto for all HPKE-4 operations
- No external crypto library in dependencies
- Bundle size estimates that don't account for crypto library

**Prevention:**
- Use `@noble/ciphers` for ChaCha20Poly1305 (audited, minimal)
- Use `@hpke/chacha20poly1305` with `@hpke/core` for full HPKE
- WebCrypto for P-256 + AES-256-GCM (HPKE-7) is fine

**Detection:** Check project deps early; verify ChaCha20Poly1305 source.

**Phase:** Stack selection and crypto foundation (Phase 1)

**Sources:** [W3C WebCrypto Issue #223](https://github.com/w3c/webcrypto/issues/223), [@noble/ciphers](https://github.com/paulmillr/noble-ciphers)

---

## Moderate Pitfalls

Mistakes that cause bugs, spec non-compliance, or technical debt.

### Pitfall 7: CBOR Non-Deterministic Encoding

**What goes wrong:** Using non-deterministic CBOR encoding causes signature verification failures when verifying parties re-encode structures, and prevents reliable hashing/deduplication.

**Why it happens:** CBOR allows multiple valid encodings for the same value (integer sizes, map key ordering). Different CBOR libraries may produce different byte sequences for identical data.

**Consequences:**
- Signature verification failures
- Hash mismatches
- Interoperability issues with other implementations

**Warning signs:**
- Different CBOR output for same logical structure across runs
- Using CBOR library without deterministic encoding option
- Map key ordering inconsistent

**Prevention:**
- Use CBOR library that supports Core Deterministic Encoding (RFC 8949 Section 4.2)
- Explicitly configure deterministic/canonical encoding
- Test that encoding is stable across runs

**Detection:** Encode same COSE_Key twice, compare byte output.

**Phase:** CBOR/COSE encoding layer (Phase 1-2)

**Sources:** [RFC 8949 Section 4.2](https://www.rfc-editor.org/rfc/rfc8949.html#section-4.2), [CBOR Deterministic Encoding](https://cborbook.com/part_2/determinism.html)

---

### Pitfall 8: COSE_Key Parameter Confusion (EC2 vs OKP)

**What goes wrong:** Mixing up COSE_Key parameters between EC2 (P-256) and OKP (X25519) key types causes key import/export failures or silent crypto errors.

**Why it happens:**
- EC2 keys use `-2` (x), `-3` (y), `-4` (d) parameters
- OKP keys use `-2` (x), `-4` (d) parameters (no y coordinate)
- Same parameter numbers, different meanings

**Consequences:**
- Keys fail to import
- Crypto operations fail silently
- Invalid COSE_Key structures

**Warning signs:**
- Generic "key" handling without type checking
- Copy-pasting EC2 code for OKP keys
- Missing `kty` validation before parameter access

**Prevention:**
- Check `kty` (key type) first in all key handling
- Use separate code paths for EC2 and OKP keys
- Validate COSE_Key structure against CDDL schema
- Test with both P-256 and X25519 keys

**Detection:** Import P-256 key as X25519 or vice versa; should fail clearly.

**Phase:** COSE_Key implementation (Phase 2)

**Sources:** [RFC 9052 Section 7](https://datatracker.ietf.org/doc/rfc9052/)

---

### Pitfall 9: Algorithm ID Mismatch Between Modes

**What goes wrong:** Using same algorithm identifier in wrong COSE-HPKE mode (e.g., Integrated encryption algorithm in Key Encryption recipient).

**Why it happens:** COSE-HPKE defines distinct algorithm IDs for Integrated vs Key Encryption modes. The spec states: "Algorithm identifiers MUST only be used in the COSE HPKE mode that is specified for them."

**Consequences:**
- Spec non-compliance
- Interoperability failures
- Unclear error messages

**Warning signs:**
- Single algorithm constant used across both modes
- No validation of algorithm ID against message structure type
- Tests that only cover one mode

**Prevention:**
- Define separate constants for Integrated vs Key Encryption algorithms
- Validate algorithm ID against COSE structure type (COSE_Encrypt0 vs COSE_Encrypt)
- Test both modes with correct and incorrect algorithm IDs

**Detection:** Try using Integrated encryption alg ID in COSE_Encrypt recipient.

**Phase:** Algorithm registry implementation (Phase 2)

**Sources:** [draft-ietf-cose-hpke](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/)

---

### Pitfall 10: AAD (Additional Authenticated Data) Omission

**What goes wrong:** Not binding the correct COSE structure to the AEAD's AAD causes the encryption to not authenticate the headers, enabling header manipulation attacks.

**Why it happens:** Developers focus on plaintext encryption, forgetting that COSE requires specific `Enc_structure` or `Recipient_structure` to be included as AAD per RFC 9052 Section 5.3.

**Consequences:**
- Header manipulation attacks
- Algorithm downgrade attacks
- Protected header bypass

**Warning signs:**
- Empty AAD in AEAD calls
- AAD that's just the plaintext
- No `Enc_structure` serialization code

**Prevention:**
- Follow RFC 9052 Section 5.3 exactly for AAD construction
- Serialize protected headers into AAD per spec
- Include `external_aad` if provided by application
- Test header modification is detected

**Detection:** Modify protected header after encryption; decryption should fail.

**Phase:** COSE structure implementation (Phase 2)

**Sources:** [RFC 9052 Section 5.3](https://datatracker.ietf.org/doc/rfc9052/)

---

### Pitfall 11: URL Fragment Size Limits

**What goes wrong:** Encrypted messages exceed browser URL limits, causing truncation or sharing failures on certain platforms.

**Why it happens:** While modern browsers support 2MB+ URLs, intermediate systems (email clients, chat apps, URL shorteners, social media) often truncate at 2000-8000 characters.

**Consequences:**
- Truncated messages fail to decrypt
- Silent corruption on sharing
- Poor user experience

**Warning signs:**
- No size validation before URL generation
- No user warning for large messages
- Testing only with small payloads

**Prevention:**
- Calculate final URL length before presenting to user
- Warn if URL exceeds safe limit (~2000 chars for maximum compatibility)
- Offer file download alternative for large messages
- Show message size estimate before encryption

**Detection:** Encrypt 10KB message, check URL length, test in email client.

**Phase:** Demo UI and URL encoding (Phase 4)

**Sources:** [URL Length Limits](https://www.geeksforgeeks.org/computer-networks/maximum-length-of-a-url-in-different-browsers/)

---

### Pitfall 12: Decompression Bomb via CompressionStream

**What goes wrong:** Attacker crafts small compressed payload that expands to gigabytes, crashing the browser tab or device.

**Why it happens:** DecompressionStream has no built-in size limits. A 1KB payload can decompress to 1GB+ using nested compression or high-ratio compressible patterns.

**Consequences:**
- Browser tab crash
- Device memory exhaustion
- Denial of service

**Warning signs:**
- No size limit on decompression output
- Decompressing before any validation
- No streaming with size checks

**Prevention:**
- Set maximum decompressed size (e.g., 1MB for URL fragment use case)
- Stream decompression with running byte count
- Abort if decompressed size exceeds limit
- Validate/decrypt before decompress if possible (though COSE requires decompress first)

**Detection:** Create 1KB payload that decompresses to 100MB; verify rejection.

**Phase:** Compression implementation (Phase 3-4)

**Sources:** [Decompression Bombs](https://www.huntress.com/cybersecurity-101/topic/what-is-zip-bomb)

---

## Minor Pitfalls

Mistakes that cause annoyance, user confusion, or minor issues.

### Pitfall 13: CDDL Diagnostic Notation Display Errors

**What goes wrong:** Displaying CBOR in CDDL diagnostic notation with incorrect escaping, missing tags, or wrong type indicators confuses developers trying to debug.

**Why it happens:** CDDL diagnostic notation has specific syntax (h'hex', bstr, tstr, tags). Manual formatting often misses edge cases.

**Consequences:**
- User confusion
- Debug difficulty
- Misleading output

**Prevention:**
- Use library function for diagnostic output if available
- Test all CBOR types (bstr, tstr, int, map, array, tagged)
- Include tag numbers in display

**Phase:** Display/debugging features (Phase 3)

---

### Pitfall 14: Base64url Padding Inconsistency

**What goes wrong:** Some base64url encoders add padding (`=`), others don't. Decoders may require or reject padding, causing import/export failures.

**Why it happens:** RFC 4648 allows optional padding for base64url. Different libraries make different choices.

**Consequences:**
- Import failures for externally generated URLs
- Export incompatibility with other tools

**Prevention:**
- Encode without padding (standard for URL use)
- Decode accepting both padded and unpadded
- Test with external tools

**Phase:** URL encoding (Phase 3)

---

### Pitfall 15: Missing Error Messages for Crypto Failures

**What goes wrong:** Crypto libraries throw generic errors ("decryption failed", "invalid key") that don't help users understand what went wrong.

**Why it happens:** Crypto libraries deliberately hide details to prevent oracle attacks. But user-facing apps need helpful error handling without leaking sensitive info.

**Consequences:**
- User frustration
- Support burden
- Debugging difficulty

**Prevention:**
- Map low-level crypto errors to user-friendly messages
- "Wrong key" vs "Corrupted message" vs "Expired message"
- Log detailed errors server-side (if applicable), show generic client-side
- Never expose timing-sensitive info in error messages

**Phase:** Error handling throughout (all phases)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Crypto foundation | ChaCha20Poly1305 not in WebCrypto | Use @noble/ciphers or @hpke/* |
| Crypto foundation | Bad RNG | Always crypto.getRandomValues() |
| HPKE implementation | Context reuse | Fresh context per operation |
| HPKE implementation | Timing attacks | Use library verify functions |
| COSE encoding | Non-deterministic CBOR | Configure deterministic mode |
| COSE_Key handling | EC2/OKP parameter confusion | Check kty first, separate paths |
| AAD construction | Missing Enc_structure | Follow RFC 9052 Section 5.3 |
| Key storage | localStorage XSS | Accept risk, add CSP, warn users |
| URL encoding | Fragment size limits | Validate size, warn user |
| Compression | Decompression bomb | Limit decompressed size |

---

## Testing Checklist for Pitfall Prevention

Security-focused tests to add:

- [ ] Fresh `enc` value on each encryption (no context reuse)
- [ ] All random values are unique across 1000 operations
- [ ] Modified ciphertext fails authentication (no silent corruption)
- [ ] Modified protected header fails decryption (AAD binding)
- [ ] Wrong key type import fails explicitly
- [ ] URL length warning for messages > 2KB
- [ ] Decompression stops at size limit
- [ ] Both padded and unpadded base64url decode correctly

---

## Sources

### Primary (HIGH confidence)
- [RFC 9180: Hybrid Public Key Encryption](https://www.rfc-editor.org/rfc/rfc9180.html)
- [RFC 9052: COSE Structures and Process](https://datatracker.ietf.org/doc/rfc9052/)
- [draft-ietf-cose-hpke](https://datatracker.ietf.org/doc/draft-ietf-cose-hpke/)
- [RFC 8949: CBOR](https://www.rfc-editor.org/rfc/rfc8949.html)

### Implementation References (MEDIUM confidence)
- [@noble/ciphers](https://github.com/paulmillr/noble-ciphers)
- [@hpke/chacha20poly1305](https://www.npmjs.com/package/@hpke/chacha20poly1305)
- [W3C WebCrypto Issues](https://github.com/w3c/webcrypto/issues/223)

### Security Research (MEDIUM confidence)
- [Auth0: Secure Browser Storage](https://auth0.com/blog/secure-browser-storage-the-facts/)
- [libsodium AEAD](https://doc.libsodium.org/secret-key_cryptography/aead)
- [CBOR Determinism](https://cborbook.com/part_2/determinism.html)
