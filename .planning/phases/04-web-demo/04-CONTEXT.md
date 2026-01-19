# Phase 4: Web Demo - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Browser-based encryption and decryption demo hosted on GitHub Pages. Users can generate keypairs, manage keys in localStorage, encrypt messages to recipients via shareable URLs, and decrypt messages from URL fragments. All cryptography happens client-side using the library from Phase 1 and URL transport from Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Page structure
- Single page with tabs (Keys, Encrypt, Decrypt views)
- Modern dark theme visual style
- Tailwind CSS for styling
- Text-only tab labels (no icons)

### Key management UI
- Key list shows: name + truncated key ID (first 8 chars of fingerprint)
- Import and export both supported
- CBOR hex format for import/export (CLI compatible)
- Confirm dialog before key deletion
- Empty state: quick generate inline (name input field right there)

### Encrypt flow
- Recipient selection: dropdown of saved public keys + paste option for one-time keys
- Multi-line textarea for message input
- After encrypting: show QR code + copy button for shareable URL

### Decrypt flow
- Try all private keys automatically
- Use kid hint from COSE message to select correct key first if available
- If no private keys exist: show error + button to redirect to Keys tab

### Error states
- Decryption failure: inline error message (red text below decrypt area)
- Explain what went wrong (wrong key, corrupted data, etc.)

### User guidance
- Single help modal accessible via info icon
- UI should be largely self-explanatory otherwise

### Claude's Discretion
- Exact Tailwind color palette within dark theme
- Tab implementation details
- QR code library choice
- Specific error message wording
- Key fingerprint derivation method

</decisions>

<specifics>
## Specific Ideas

- CLI interoperability is important — same CBOR hex format for keys means users can generate in CLI and use in browser or vice versa
- QR code for mobile sharing — recipient can scan on phone to decrypt
- "Try all keys with kid hint first" — smart auto-selection without user friction

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-web-demo*
*Context gathered: 2026-01-19*
