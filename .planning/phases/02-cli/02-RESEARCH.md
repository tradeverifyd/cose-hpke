# Phase 2: CLI - Research

**Researched:** 2026-01-19
**Domain:** CLI Framework (citty) + Key Display + Shareable URLs
**Confidence:** HIGH

## Summary

Phase 2 delivers a command-line interface for the COSE-HPKE library using the **citty** framework from UnJS. The CLI exposes three commands: `keygen`, `encrypt`, and `decrypt`. Per CONTEXT.md decisions, keys display in CBOR diagnostic notation (EDN format: `{1: 2, -1: 1, -2: h'...'}`) with hex-encoded CBOR, encrypted messages output shareable URLs by default, and file output uses raw CBOR binary.

Research confirms citty supports subcommands via `subCommands` property in `defineCommand`, with positional and typed arguments. For shareable URLs, the standard pattern (used by Excalidraw, Firefox Send) stores encrypted data in the URL fragment (`#`) which browsers never send to servers - enabling privacy-preserving sharing.

**Primary recommendation:** Structure CLI with main entry point using `runMain()`, three subcommands (keygen, encrypt, decrypt), and utility modules for output formatting and URL encoding. Use base64url encoding for URL fragments.

## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **citty** | ^0.1.6 | CLI framework | UnJS ecosystem, TypeScript-first, subcommand support, auto-help |
| **cbor2** | ^2.0.1 | Diagnostic notation | Already in project, `diagnose()` produces EDN format |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **consola** | ^3.2.3 | Styled console output | citty dependency, available for formatted output |
| (built-in) | - | `Bun.stdin` / `Bun.file()` | Reading key files and stdin |
| (built-in) | - | `btoa`/`atob` | Base64url encoding for URLs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| citty | commander | More mature but heavier, less TypeScript integration |
| citty | meow | Simpler but no subcommand support |
| citty | oclif | Enterprise-grade but overkill for 3 commands |

**Installation:**
```bash
bun add citty
```

**Note:** cbor2 already installed from Phase 1.

## Architecture Patterns

### Recommended Project Structure
```
src/
  cli/
    index.ts          # Main entry, runMain() with subCommands
    commands/
      keygen.ts       # keygen command definition
      encrypt.ts      # encrypt command definition
      decrypt.ts      # decrypt command definition
    util/
      format.ts       # Output formatting (diagnostic + hex)
      url.ts          # URL encoding/decoding for shareable links
      io.ts           # File/stdin reading utilities
```

### Pattern 1: Citty Subcommands Structure

**What:** Define main command with `subCommands` object containing child commands.
**When to use:** Multi-command CLI tools (like git, npm).
**Example:**

```typescript
// Source: https://github.com/unjs/citty
import { defineCommand, runMain } from 'citty';
import keygen from './commands/keygen.ts';
import encrypt from './commands/encrypt.ts';
import decrypt from './commands/decrypt.ts';

const main = defineCommand({
  meta: {
    name: 'cose-hpke',
    version: '0.1.0',
    description: 'COSE-HPKE encryption CLI',
  },
  subCommands: {
    keygen,
    encrypt,
    decrypt,
  },
});

runMain(main);
```

### Pattern 2: Command Definition with Args

**What:** Each command defines its arguments with type, description, and validation.
**When to use:** Every subcommand.
**Example:**

```typescript
// Source: citty documentation
export default defineCommand({
  meta: {
    name: 'encrypt',
    description: 'Encrypt a message for one or more recipients',
  },
  args: {
    message: {
      type: 'positional',
      description: 'Message to encrypt (or - for stdin)',
      required: true,
    },
    recipient: {
      type: 'string',
      alias: 'r',
      description: 'Recipient public key file (can be repeated)',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output file path (.cose extension)',
      valueHint: 'file.cose',
    },
  },
  async run({ args }) {
    // Implementation
  },
});
```

### Pattern 3: URL Fragment for Encrypted Data

**What:** Store encrypted CBOR in URL fragment using base64url encoding.
**When to use:** Default encrypt output for shareable links.
**Why:** Fragment (`#...`) never sent to server; enables privacy-preserving sharing.

```typescript
// Source: Excalidraw E2E encryption pattern
// https://plus.excalidraw.com/blog/end-to-end-encryption

function createShareableUrl(cborBytes: Uint8Array): string {
  const base64url = toBase64Url(cborBytes);
  return `https://example.com/decrypt#${base64url}`;
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

### Pattern 4: Key Display Format (Diagnostic + Hex)

**What:** Display keys as both CBOR diagnostic notation and hex-encoded CBOR.
**When to use:** keygen command output.
**Why:** CONTEXT.md specifies "CDDL instance representation + hex-encoded CBOR".

```typescript
// Source: cbor2 diagnose() output
import { diagnose, encode } from 'cbor2';

function formatKeyOutput(keyBytes: Uint8Array, label: string): string {
  const diagnostic = diagnose(keyBytes);
  const hex = Buffer.from(keyBytes).toString('hex');

  return `${label}:
  ${diagnostic}

  CBOR (hex): ${hex}`;
}

// Example output:
// Public Key:
//   {1: 2, -1: 1, -2: h'65eda5a1...', -3: h'1e52ed75...'}
//
//   CBOR (hex): a401022001...
```

### Pattern 5: Reading Keys from Files

**What:** Support multiple input sources for keys (file path, stdin).
**When to use:** encrypt and decrypt commands.
**Why:** Flexibility for different workflows (scripting, interactive).

```typescript
// Source: Bun documentation
async function readKeyFromSource(source: string): Promise<Uint8Array> {
  if (source === '-') {
    // Read from stdin
    const chunks: Uint8Array[] = [];
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(chunk);
    }
    return concatBytes(chunks);
  }

  // Read from file
  const file = Bun.file(source);
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}
```

### Anti-Patterns to Avoid

- **JSON output for keys:** CONTEXT.md explicitly prohibits JSON; only CBOR diagnostic notation
- **Storing data in URL query params:** Use fragment (`#`) not query (`?`) for privacy
- **Reading entire file as text:** Keys are binary CBOR; read as ArrayBuffer
- **Hardcoded base URL:** Make the shareable URL base configurable or obvious

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Argument parsing | Manual process.argv | citty's args | Type coercion, validation, help generation |
| Help text | String formatting | citty auto-help | --help flag handled automatically |
| Diagnostic notation | String building | cbor2.diagnose() | Handles all CBOR types, edge cases |
| Base64url encoding | Regex on standard base64 | Utility function (exists in key.ts) | Padding edge cases already solved |
| Exit codes | Ad-hoc numbers | Standard conventions | 0=success, 1=general error, 2=usage error |

**Key insight:** citty handles CLI boilerplate (arg parsing, help, version); cbor2 handles CBOR display. Focus implementation on the actual encrypt/decrypt logic.

## Common Pitfalls

### Pitfall 1: Confusing CDDL and EDN

**What goes wrong:** CONTEXT.md says "CDDL instance representation" but CDDL is a schema language, not a value notation.
**Why it happens:** CDDL and EDN are related but distinct; terminology often confused.
**How to avoid:** What the user wants is EDN diagnostic notation (`{1: 2, -2: h'...'}`). This is exactly what cbor2's `diagnose()` produces.
**Warning signs:** Trying to generate CDDL schema syntax for concrete values.

### Pitfall 2: URL Fragment Size Limits

**What goes wrong:** Very large encrypted messages may exceed browser URL length limits (~2KB safe, ~64KB max varies by browser).
**Why it happens:** Base64 encoding expands data by ~33%.
**How to avoid:** Recommend file output (`--output`) for large messages. Show warning if URL exceeds safe threshold.
**Warning signs:** Users report "URL too long" errors or truncation.

### Pitfall 3: Binary vs Text File Handling

**What goes wrong:** Reading CBOR files as text corrupts the data.
**Why it happens:** Default file reads often assume UTF-8 text.
**How to avoid:** Always use `Bun.file().arrayBuffer()` or equivalent binary reads.
**Warning signs:** Decryption fails with "invalid CBOR" on valid files.

### Pitfall 4: Missing Newlines in Output

**What goes wrong:** Output runs together when piped; hex strings have no breaks.
**Why it happens:** Forgetting trailing newlines in console output.
**How to avoid:** Always append `\n` to output. Consider line-wrapping long hex strings.
**Warning signs:** `cli keygen | other-command` fails to parse.

### Pitfall 5: Stdin Detection

**What goes wrong:** CLI hangs waiting for stdin when user expected file argument.
**Why it happens:** No clear indication of stdin mode; user confusion.
**How to avoid:** Use explicit `-` argument for stdin, not auto-detection. Show usage hint if no input provided.
**Warning signs:** Users report "CLI is frozen".

## Code Examples

Verified patterns from official sources:

### Complete keygen Command

```typescript
// Source: citty documentation + cose-hpke library
import { defineCommand } from 'citty';
import { generateKeyPair, toDiagnostic } from 'cose-hpke';

export default defineCommand({
  meta: {
    name: 'keygen',
    description: 'Generate a new COSE-HPKE keypair',
  },
  args: {},
  async run() {
    const { publicKey, privateKey } = await generateKeyPair();

    console.log('Public Key:');
    console.log(`  ${toDiagnostic(publicKey)}`);
    console.log(`  CBOR (hex): ${Buffer.from(publicKey).toString('hex')}`);
    console.log('');
    console.log('Private Key:');
    console.log(`  ${toDiagnostic(privateKey)}`);
    console.log(`  CBOR (hex): ${Buffer.from(privateKey).toString('hex')}`);
  },
});
```

### Encrypt Command with URL Output

```typescript
// Source: citty + Excalidraw URL fragment pattern
import { defineCommand } from 'citty';
import { encrypt } from 'cose-hpke';

export default defineCommand({
  meta: {
    name: 'encrypt',
    description: 'Encrypt a message to recipients',
  },
  args: {
    message: {
      type: 'positional',
      description: 'Message to encrypt',
      required: true,
    },
    recipient: {
      type: 'string',
      alias: 'r',
      description: 'Path to recipient public key file',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output to file instead of URL',
      valueHint: 'file.cose',
    },
  },
  async run({ args }) {
    const recipientKey = await Bun.file(args.recipient).arrayBuffer();
    const plaintext = new TextEncoder().encode(args.message);

    const ciphertext = await encrypt(plaintext, [new Uint8Array(recipientKey)]);

    if (args.output) {
      await Bun.write(args.output, ciphertext);
      console.log(`Encrypted message saved to: ${args.output}`);
    } else {
      const url = createShareableUrl(ciphertext);
      console.log(url);
    }
  },
});

function createShareableUrl(bytes: Uint8Array): string {
  const base64url = toBase64Url(bytes);
  // TODO: Make base URL configurable
  return `https://cose-hpke.example.com/decrypt#${base64url}`;
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

### Package.json bin Configuration

```json
// Source: https://pmbanugo.me/blog/build-cli-typescript-bun
{
  "name": "cose-hpke",
  "bin": {
    "cose-hpke": "./src/cli/index.ts"
  },
  "scripts": {
    "cli": "bun run src/cli/index.ts"
  }
}
```

### Shebang for Direct Execution

```typescript
#!/usr/bin/env bun
// src/cli/index.ts
import { defineCommand, runMain } from 'citty';
// ... command definitions
```

## Clarification: CDDL vs EDN

Per RFC 8610 and the CBOR EDN draft:

| Term | What It Is | Example |
|------|------------|---------|
| **CDDL** | Schema/grammar language | `COSE_Key = { 1 => int, -1 => int }` |
| **EDN** | Value/instance notation | `{1: 2, -1: 1, -2: h'abcd'}` |

CONTEXT.md says "CDDL instance representation" - this is technically EDN diagnostic notation. The cbor2 library's `diagnose()` function produces EDN format, which is the correct output for displaying CBOR values.

**Validation:** Ran `diagnose()` on a COSE_Key Map - output is `{1: 2, -1: 1, -2: h'010203', -3: h'040506'}` - exactly the expected format.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| meow for CLI | citty | 2023+ | Better TypeScript, subcommand support |
| Base64 in URL query | Base64url in URL fragment | E2E encryption pattern | Privacy (fragment not sent to server) |
| JSON key display | CBOR diagnostic notation | COSE ecosystem | Interoperability with COSE tools |

**Deprecated/outdated:**
- Using JSON for COSE key display (breaks CBOR ecosystem conventions)
- Storing encrypted data in URL query parameters (privacy leak)

## Open Questions

Things that couldn't be fully resolved:

1. **Base URL for shareable links**
   - What we know: URL fragment pattern works universally
   - What's unclear: What domain/path to use as base
   - Recommendation: Make configurable via environment variable or use placeholder. User can provide their own decoder page.

2. **Multiple recipient handling in CLI**
   - What we know: Library supports multi-recipient encryption
   - What's unclear: CLI UX for specifying multiple recipients
   - Recommendation: Allow repeated `--recipient` flags (`-r key1.pub -r key2.pub`)

3. **Error message formatting**
   - What we know: citty has graceful error handling
   - What's unclear: What level of verbosity users expect
   - Recommendation: Default to user-friendly messages; add `--verbose` flag for debug info

## Sources

### Primary (HIGH confidence)
- [citty GitHub](https://github.com/unjs/citty) - Command definition, subCommands, runMain
- [Bun stdin docs](https://bun.sh/guides/process/stdin) - Bun.stdin.stream() for binary reading
- [RFC 8949 Section 8](https://www.rfc-editor.org/rfc/rfc8949.html) - Diagnostic notation format (EDN)
- [cbor2 test](verified locally) - `diagnose()` produces `{1: 2, -2: h'...'}` format

### Secondary (MEDIUM confidence)
- [Excalidraw E2E encryption blog](https://plus.excalidraw.com/blog/end-to-end-encryption) - URL fragment pattern for shareable encrypted links
- [Build CLI with Bun](https://pmbanugo.me/blog/build-cli-typescript-bun) - package.json bin configuration, shebang

### Tertiary (LOW confidence)
- WebSearch results for citty valueHint - limited documentation
- URL length limits - varies by browser, general guidance only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - citty documented, cbor2 verified
- Architecture: HIGH - Standard patterns from citty docs
- URL fragment pattern: MEDIUM - Widely used but details vary
- Pitfalls: MEDIUM - Based on general CLI development patterns

**Research date:** 2026-01-19
**Valid until:** 90 days (citty stable at 0.1.6, patterns well-established)
