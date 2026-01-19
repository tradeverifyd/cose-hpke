import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readFileSync } from 'fs';

describe('Browser Bundle', () => {
  beforeAll(async () => {
    // Build the demo bundle
    const proc = Bun.spawn(['bun', 'run', 'build:demo'], {
      cwd: process.cwd(),
      stdout: 'inherit',
      stderr: 'inherit',
    });
    await proc.exited;
  });

  it('creates demo/lib.js', () => {
    expect(existsSync('demo/lib.js')).toBe(true);
  });

  it('creates sourcemap', () => {
    expect(existsSync('demo/lib.js.map')).toBe(true);
  });

  it('does not contain Buffer.from or Buffer.alloc references', () => {
    const content = readFileSync('demo/lib.js', 'utf-8');
    // Check for Node.js Buffer API patterns (not ArrayBuffer)
    expect(content).not.toContain('Buffer.from');
    expect(content).not.toContain('Buffer.alloc');
    expect(content).not.toContain("require('buffer')");
    expect(content).not.toContain('require("buffer")');
  });

  it('exports expected functions', async () => {
    // Dynamic import the built bundle
    const lib = await import('../demo/lib.js');

    // Core functions
    expect(typeof lib.generateKeyPair).toBe('function');
    expect(typeof lib.encrypt).toBe('function');
    expect(typeof lib.decrypt).toBe('function');
    expect(typeof lib.encodeCoseKey).toBe('function');
    expect(typeof lib.decodeCoseKey).toBe('function');
    expect(typeof lib.toDiagnostic).toBe('function');

    // URL transport functions
    expect(typeof lib.createShareableUrl).toBe('function');
    expect(typeof lib.parseShareableUrl).toBe('function');
    expect(typeof lib.encodeFragment).toBe('function');
    expect(typeof lib.decodeFragment).toBe('function');
    expect(typeof lib.toBase64Url).toBe('function');
    expect(typeof lib.fromBase64Url).toBe('function');
  });

  it('can generate keypair', async () => {
    const lib = await import('../demo/lib.js');
    const keypair = await lib.generateKeyPair();

    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey.length).toBeGreaterThan(0);
    expect(keypair.privateKey.length).toBeGreaterThan(0);
  });

  it('can encrypt and decrypt', async () => {
    const lib = await import('../demo/lib.js');
    const keypair = await lib.generateKeyPair();
    const plaintext = new TextEncoder().encode('Hello, browser!');

    const ciphertext = await lib.encrypt(plaintext, [keypair.publicKey]);
    const decrypted = await lib.decrypt(ciphertext, keypair.privateKey);

    expect(new TextDecoder().decode(decrypted)).toBe('Hello, browser!');
  });

  it('can create and parse shareable URL', async () => {
    const lib = await import('../demo/lib.js');
    const keypair = await lib.generateKeyPair();
    const plaintext = new TextEncoder().encode('URL test');

    const ciphertext = await lib.encrypt(plaintext, [keypair.publicKey]);
    const url = await lib.createShareableUrl(ciphertext);

    expect(url).toContain('#');
    expect(url.startsWith('https://cose-hpke.github.io/decrypt#')).toBe(true);

    const parsed = await lib.parseShareableUrl(url);
    expect(parsed).toBeInstanceOf(Uint8Array);
    expect(parsed.length).toBe(ciphertext.length);
  });
});
