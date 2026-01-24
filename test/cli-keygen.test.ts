// CLI keygen command tests

import { describe, test, expect, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { decodeCoseKey } from '../src/cose/key.ts';

// CLI path for tests
const CLI_PATH = new URL('../src/cli/index.ts', import.meta.url).pathname;

// Temp files for cleanup
const tempFiles: string[] = [];

afterAll(() => {
  // Clean up temp files
  for (const file of tempFiles) {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }
});

/**
 * Run CLI command and return output
 */
function runCli(...args: string[]): { output: string; exitCode: number } {
  const tmpFile = '/tmp/cli-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.txt';
  tempFiles.push(tmpFile);

  const result = spawnSync('sh', ['-c', `bun "${CLI_PATH}" ${args.join(' ')} > "${tmpFile}" 2>&1`], {
    encoding: 'utf-8',
  });

  const output = existsSync(tmpFile) ? readFileSync(tmpFile, 'utf-8') : '';

  return { output, exitCode: result.status ?? 1 };
}

describe('CLI keygen command', () => {
  test('exits with code 0', () => {
    const { exitCode } = runCli('keygen');
    expect(exitCode).toBe(0);
  });

  test('outputs Public Key:', () => {
    const { output } = runCli('keygen');
    expect(output).toContain('Public Key:');
  });

  test('outputs Private Key:', () => {
    const { output } = runCli('keygen');
    expect(output).toContain('Private Key:');
  });

  test('outputs CBOR (hex):', () => {
    const { output } = runCli('keygen');
    expect(output).toContain('CBOR (hex):');
  });

  test('outputs diagnostic notation with h\' hex markers', () => {
    const { output } = runCli('keygen');
    // CDDL diagnostic notation uses h'...' for hex byte strings
    expect(output).toContain("h'");
  });

  test('outputs key type 2 (EC2) in diagnostic', () => {
    const { output } = runCli('keygen');
    // {1: 2, ...} means kty=2 (EC2)
    expect(output).toContain('{1: 2,');
  });
});

describe('CLI keygen file output', () => {
  test('creates public key file with --output-public', () => {
    const pubPath = '/tmp/test-pub-' + Date.now() + '.cose';
    const privPath = '/tmp/test-priv-' + Date.now() + '.cose';
    tempFiles.push(pubPath, privPath);

    runCli('keygen', `--output-public "${pubPath}"`, `--output-private "${privPath}"`);
    expect(existsSync(pubPath)).toBe(true);
  });

  test('creates private key file with --output-private', () => {
    const pubPath = '/tmp/test-pub-' + Date.now() + '.cose';
    const privPath = '/tmp/test-priv-' + Date.now() + '.cose';
    tempFiles.push(pubPath, privPath);

    runCli('keygen', `--output-public "${pubPath}"`, `--output-private "${privPath}"`);
    expect(existsSync(privPath)).toBe(true);
  });

  test('public key file starts with CBOR map byte 0xa5', () => {
    const pubPath = '/tmp/test-pub-' + Date.now() + '.cose';
    const privPath = '/tmp/test-priv-' + Date.now() + '.cose';
    tempFiles.push(pubPath, privPath);

    runCli('keygen', `--output-public "${pubPath}"`, `--output-private "${privPath}"`);

    const file = Bun.file(pubPath);
    const buffer = new Uint8Array(readFileSync(pubPath));
    // 0xa5 = CBOR map with 5 items (kty, alg, crv, x, y)
    expect(buffer[0]).toBe(0xa5);
  });

  test('private key file starts with CBOR map byte 0xa6', () => {
    const pubPath = '/tmp/test-pub-' + Date.now() + '.cose';
    const privPath = '/tmp/test-priv-' + Date.now() + '.cose';
    tempFiles.push(pubPath, privPath);

    runCli('keygen', `--output-public "${pubPath}"`, `--output-private "${privPath}"`);

    const buffer = new Uint8Array(readFileSync(privPath));
    // 0xa6 = CBOR map with 6 items (kty, alg, crv, x, y, d)
    expect(buffer[0]).toBe(0xa6);
  });

  test('public key file can be decoded as valid COSE_Key', () => {
    const pubPath = '/tmp/test-pub-' + Date.now() + '.cose';
    const privPath = '/tmp/test-priv-' + Date.now() + '.cose';
    tempFiles.push(pubPath, privPath);

    runCli('keygen', `--output-public "${pubPath}"`, `--output-private "${privPath}"`);

    const bytes = new Uint8Array(readFileSync(pubPath));

    // Should not throw
    const coseKey = decodeCoseKey(bytes);
    // Verify it's an EC2 key (kty = 2)
    expect(coseKey.get(1)).toBe(2);
    // Verify it's P-256 (crv = 1)
    expect(coseKey.get(-1)).toBe(1);
  });

  test('private key file can be decoded as valid COSE_Key with d param', () => {
    const pubPath = '/tmp/test-pub-' + Date.now() + '.cose';
    const privPath = '/tmp/test-priv-' + Date.now() + '.cose';
    tempFiles.push(pubPath, privPath);

    runCli('keygen', `--output-public "${pubPath}"`, `--output-private "${privPath}"`);

    const bytes = new Uint8Array(readFileSync(privPath));

    // Should not throw
    const coseKey = decodeCoseKey(bytes);
    // Verify it has private key parameter d (-4)
    const d = coseKey.get(-4);
    expect(d).toBeInstanceOf(Uint8Array);
    expect((d as Uint8Array).length).toBe(32); // P-256 private key is 32 bytes
  });
});

describe('CLI keygen --suite option', () => {
  test('generates HPKE-7 (P-256) key by default', () => {
    const { output } = runCli('keygen');
    // {1: 2, ...} means kty=2 (EC2)
    expect(output).toContain('{1: 2,');
    expect(output).toContain('Suite: HPKE-7');
  });

  test('generates HPKE-7 (P-256) key with --suite HPKE-7', () => {
    const { output } = runCli('keygen', '--suite HPKE-7');
    // {1: 2, ...} means kty=2 (EC2)
    expect(output).toContain('{1: 2,');
    expect(output).toContain('Suite: HPKE-7');
  });

  // X25519 (HPKE-4) is not supported in Bun's WebCrypto runtime
  test.skip('generates HPKE-4 (X25519) key with --suite HPKE-4', () => {
    const { output } = runCli('keygen', '--suite HPKE-4');
    // {1: 1, ...} means kty=1 (OKP)
    expect(output).toContain('{1: 1,');
    expect(output).toContain('Suite: HPKE-4');
  });

  // X25519 (HPKE-4) is not supported in Bun's WebCrypto runtime
  test.skip('generates HPKE-4 key files with --suite HPKE-4', () => {
    const pubPath = '/tmp/test-pub-' + Date.now() + '.cose';
    const privPath = '/tmp/test-priv-' + Date.now() + '.cose';
    tempFiles.push(pubPath, privPath);

    runCli('keygen', '--suite HPKE-4', `--output-public "${pubPath}"`, `--output-private "${privPath}"`);

    const pubBytes = new Uint8Array(readFileSync(pubPath));
    const coseKey = decodeCoseKey(pubBytes);

    // kty=1 (OKP)
    expect(coseKey.get(1)).toBe(1);
    // crv=4 (X25519)
    expect(coseKey.get(-1)).toBe(4);
  });

  test('errors on invalid suite', () => {
    const { output, exitCode } = runCli('keygen', '--suite HPKE-99');
    expect(exitCode).toBe(1);
    expect(output).toContain('Invalid suite');
  });
});
