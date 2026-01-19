# Phase 2: CLI - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Command-line interface for cryptographic operations: keygen, encrypt, and decrypt. Uses citty framework. Outputs shareable URLs by default, with file output option.

</domain>

<decisions>
## Implementation Decisions

### Output format
- Keys displayed as CDDL instance representation + hex-encoded CBOR
- CDDL is the ONLY text format (no JSON, no EDN diagnostic notation)
- CBOR binary is the ONLY binary format for file output
- Encrypt command outputs shareable URL by default
- `--output file.cose` flag to save binary CBOR to file

### Claude's Discretion
- Key handling: where keys come from (files, stdin, flags)
- Error message verbosity and exit codes
- Flag naming conventions (short flags, long flags)
- Base URL structure for shareable links

</decisions>

<specifics>
## Specific Ideas

- "CDDL must be the only text format" — no JSON, no EDN
- "CBOR binary must be the only binary format" — no hex files

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-cli*
*Context gathered: 2026-01-19*
