# Phase 3: URL Transport - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Compression and URL fragment encoding for efficient encrypted message transport. Enables shareable URLs where encrypted content travels in the fragment (never sent to server).

</domain>

<decisions>
## Implementation Decisions

### Compression algorithm
- Use CompressionStream default algorithm (deflate-raw or gzip — whichever is default)
- Must work in both CLI (Bun) and browser environments
- Fallback to uncompressed if compression unavailable (larger URL but still works)

### Size handling
- Maximum URL length: 2MB (Chrome's supported limit)
- If message exceeds limit: error with clear size info (e.g., "Message too large: 3MB > 2MB limit")
- No truncation or partial data — either it fits or it errors

### Claude's Discretion
- URL structure and fragment format
- Whether to include metadata in fragment (e.g., version marker)
- Compression level if configurable

</decisions>

<specifics>
## Specific Ideas

- "Must work in both CLI and browser" — unified compression implementation
- "2MB limit based on Chrome's URL length support"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-url-transport*
*Context gathered: 2026-01-19*
