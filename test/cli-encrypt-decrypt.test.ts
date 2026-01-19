// CLI encrypt/decrypt command tests

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { generateKeyPair, encrypt, decrypt } from '../src/index.ts';
import { toBase64Url, fromBase64Url, createShareableUrl, parseShareableUrl } from '../src/cli/util/url.ts';

// CLI path for tests
const CLI_PATH = new URL('../src/cli/index.ts', import.meta.url).pathname;

// Temp files for cleanup
const tempFiles: string[] = [];

// Test keys (generated once for all tests)
let publicKeyPath: string;
let privateKeyPath: string;

beforeAll(async () => {
  // Generate keypair programmatically
  const { publicKey, privateKey } = await generateKeyPair();

  // Save to temp files
  const timestamp = Date.now();
  publicKeyPath = `/tmp/test-enc-pub-${timestamp}.cose`;
  privateKeyPath = `/tmp/test-enc-priv-${timestamp}.cose`;

  await Bun.write(publicKeyPath, publicKey);
  await Bun.write(privateKeyPath, privateKey);

  tempFiles.push(publicKeyPath, privateKeyPath);
});

afterAll(() => {
  // Clean up temp files
  for (const file of tempFiles) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
});

/**
 * Run CLI command and return output
 */
function runCli(...args: string[]): { output: string; exitCode: number } {
  const tmpFile = '/tmp/cli-enc-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.txt';
  tempFiles.push(tmpFile);

  const result = spawnSync('sh', ['-c', `bun "${CLI_PATH}" ${args.join(' ')} > "${tmpFile}" 2>&1`], {
    encoding: 'utf-8',
  });

  const output = existsSync(tmpFile) ? readFileSync(tmpFile, 'utf-8') : '';

  return { output, exitCode: result.status ?? 1 };
}

describe('URL utilities', () => {
  test('toBase64Url and fromBase64Url are inverses', () => {
    const original = new Uint8Array([1, 2, 3, 255, 254, 253, 0, 128]);
    const encoded = toBase64Url(original);
    const decoded = fromBase64Url(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  test('base64url encoding uses URL-safe characters', () => {
    // Create bytes that would produce + and / in standard base64
    const bytes = new Uint8Array([62, 255, 191]); // Would be Pv+/ in standard base64
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  test('createShareableUrl creates valid URL', () => {
    const ciphertext = new Uint8Array([1, 2, 3, 4, 5]);
    const url = createShareableUrl(ciphertext);
    expect(url).toContain('https://');
    expect(url).toContain('#');
  });

  test('parseShareableUrl extracts ciphertext', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const url = createShareableUrl(original);
    const parsed = parseShareableUrl(url);
    expect(parsed).not.toBeNull();
    expect(Array.from(parsed!)).toEqual(Array.from(original));
  });

  test('parseShareableUrl returns null for invalid URL', () => {
    expect(parseShareableUrl('not-a-url')).toBeNull();
    expect(parseShareableUrl('https://example.com')).toBeNull(); // No fragment
  });
});

describe('CLI encrypt command', () => {
  test('exits with code 0 with valid args', () => {
    const { exitCode } = runCli('encrypt', '"test message"', `-r "${publicKeyPath}"`);
    expect(exitCode).toBe(0);
  });

  test('outputs URL starting with https://', () => {
    const { output } = runCli('encrypt', '"hello world"', `-r "${publicKeyPath}"`);
    expect(output.trim()).toMatch(/^https:\/\//);
  });

  test('URL contains base64url in fragment', () => {
    const { output } = runCli('encrypt', '"hello world"', `-r "${publicKeyPath}"`);
    const url = output.trim();
    expect(url).toContain('#');
    const fragment = url.split('#')[1];
    // base64url should not have + or / or trailing =
    expect(fragment).not.toContain('+');
    expect(fragment).not.toContain('/');
  });

  test('--output flag creates file', () => {
    const outPath = `/tmp/test-encrypt-out-${Date.now()}.cose`;
    tempFiles.push(outPath);

    runCli('encrypt', '"test"', `-r "${publicKeyPath}"`, `--output "${outPath}"`);
    expect(existsSync(outPath)).toBe(true);
  });

  test('output file contains CBOR binary', () => {
    const outPath = `/tmp/test-encrypt-out-${Date.now()}.cose`;
    tempFiles.push(outPath);

    runCli('encrypt', '"test"', `-r "${publicKeyPath}"`, `--output "${outPath}"`);

    const bytes = new Uint8Array(readFileSync(outPath));
    // Should start with CBOR tag for COSE_Encrypt0 (0xd0 83)
    expect(bytes[0]).toBe(0xd0);
    expect(bytes[1]).toBe(0x83);
  });
});

describe('CLI decrypt command', () => {
  test('exits with code 0 with valid file input', () => {
    const outPath = `/tmp/test-decrypt-in-${Date.now()}.cose`;
    tempFiles.push(outPath);

    // First encrypt
    runCli('encrypt', '"test decrypt"', `-r "${publicKeyPath}"`, `--output "${outPath}"`);

    // Then decrypt
    const { exitCode } = runCli('decrypt', `"${outPath}"`, `-k "${privateKeyPath}"`);
    expect(exitCode).toBe(0);
  });

  test('decrypts file to original message', () => {
    const outPath = `/tmp/test-decrypt-file-${Date.now()}.cose`;
    tempFiles.push(outPath);

    const message = 'Hello from file';
    runCli('encrypt', `"${message}"`, `-r "${publicKeyPath}"`, `--output "${outPath}"`);

    const { output } = runCli('decrypt', `"${outPath}"`, `-k "${privateKeyPath}"`);
    expect(output.trim()).toBe(message);
  });

  test('decrypts URL to original message', () => {
    const message = 'Hello from URL';
    const { output: encryptOutput } = runCli('encrypt', `"${message}"`, `-r "${publicKeyPath}"`);
    const url = encryptOutput.trim();

    const { output: decryptOutput } = runCli('decrypt', `"${url}"`, `-k "${privateKeyPath}"`);
    expect(decryptOutput.trim()).toBe(message);
  });
});

describe('Encrypt/decrypt round-trip', () => {
  test('round-trip via URL preserves message', () => {
    const message = 'Round-trip test message with special chars: @#$%^&*()';

    // Encrypt
    const { output: encryptOutput } = runCli('encrypt', `"${message}"`, `-r "${publicKeyPath}"`);
    const url = encryptOutput.trim();

    // Decrypt
    const { output: decryptOutput } = runCli('decrypt', `"${url}"`, `-k "${privateKeyPath}"`);
    expect(decryptOutput.trim()).toBe(message);
  });

  test('round-trip via file preserves message', () => {
    const outPath = `/tmp/test-roundtrip-${Date.now()}.cose`;
    tempFiles.push(outPath);

    const message = 'File round-trip test';

    // Encrypt to file
    runCli('encrypt', `"${message}"`, `-r "${publicKeyPath}"`, `--output "${outPath}"`);

    // Decrypt from file
    const { output } = runCli('decrypt', `"${outPath}"`, `-k "${privateKeyPath}"`);
    expect(output.trim()).toBe(message);
  });

  test('library round-trip matches CLI round-trip', async () => {
    const message = 'Library vs CLI test';
    const plaintext = new TextEncoder().encode(message);

    // Read keys
    const publicKey = new Uint8Array(await Bun.file(publicKeyPath).arrayBuffer());
    const privateKey = new Uint8Array(await Bun.file(privateKeyPath).arrayBuffer());

    // Library encrypt
    const ciphertext = await encrypt(plaintext, [publicKey]);

    // Library decrypt
    const decrypted = await decrypt(ciphertext, privateKey);
    expect(new TextDecoder().decode(decrypted)).toBe(message);

    // CLI should produce compatible ciphertext
    const { output: cliOutput } = runCli('encrypt', `"${message}"`, `-r "${publicKeyPath}"`);
    const url = cliOutput.trim();

    // Parse URL and decrypt with library
    const parsed = parseShareableUrl(url);
    expect(parsed).not.toBeNull();
    const cliDecrypted = await decrypt(parsed!, privateKey);
    expect(new TextDecoder().decode(cliDecrypted)).toBe(message);
  });
});
