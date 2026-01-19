import { describe, it, expect } from 'bun:test';
import {
  generateKeyPair,
  decodeCoseKey,
  toDiagnostic,
  COSE_KEY_KTY,
  COSE_KEY_CRV,
  COSE_KEY_X,
  COSE_KEY_Y,
  COSE_KEY_D,
  KTY_EC2,
  CRV_P256,
} from '../src/index.ts';

describe('generateKeyPair', () => {
  it('generates a valid P-256 keypair', async () => {
    const { publicKey, privateKey } = await generateKeyPair();

    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(privateKey).toBeInstanceOf(Uint8Array);

    // Decode and verify structure
    const pubDecoded = decodeCoseKey(publicKey);
    const privDecoded = decodeCoseKey(privateKey);

    // Public key has kty, crv, x, y
    expect(pubDecoded.get(COSE_KEY_KTY)).toBe(KTY_EC2);
    expect(pubDecoded.get(COSE_KEY_CRV)).toBe(CRV_P256);
    expect(pubDecoded.get(COSE_KEY_X)).toBeInstanceOf(Uint8Array);
    expect(pubDecoded.get(COSE_KEY_Y)).toBeInstanceOf(Uint8Array);
    expect(pubDecoded.has(COSE_KEY_D)).toBe(false);

    // X and Y coordinates should be 32 bytes each
    const x = pubDecoded.get(COSE_KEY_X) as Uint8Array;
    const y = pubDecoded.get(COSE_KEY_Y) as Uint8Array;
    expect(x.length).toBe(32);
    expect(y.length).toBe(32);

    // Private key also has d
    expect(privDecoded.get(COSE_KEY_KTY)).toBe(KTY_EC2);
    expect(privDecoded.get(COSE_KEY_CRV)).toBe(CRV_P256);
    expect(privDecoded.has(COSE_KEY_D)).toBe(true);

    // D (private scalar) should be 32 bytes
    const d = privDecoded.get(COSE_KEY_D) as Uint8Array;
    expect(d.length).toBe(32);
  });

  it('generates unique keypairs each call', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();

    // Keys should be different
    const pub1 = decodeCoseKey(kp1.publicKey);
    const pub2 = decodeCoseKey(kp2.publicKey);

    const x1 = pub1.get(COSE_KEY_X) as Uint8Array;
    const x2 = pub2.get(COSE_KEY_X) as Uint8Array;

    // Compare as hex strings for clearer error messages
    const x1Hex = Buffer.from(x1).toString('hex');
    const x2Hex = Buffer.from(x2).toString('hex');
    expect(x1Hex).not.toEqual(x2Hex);
  });
});

describe('toDiagnostic', () => {
  it('outputs CDDL diagnostic notation', async () => {
    const { publicKey } = await generateKeyPair();
    const diag = toDiagnostic(publicKey);

    // Should contain map structure
    expect(diag).toContain('{');
    expect(diag).toContain('}');

    // Should contain key type (kty = 2)
    expect(diag).toMatch(/1:\s*2/);

    // Should contain curve (crv = 1)
    expect(diag).toMatch(/-1:\s*1/);

    // Should contain hex byte strings for x and y coordinates
    expect(diag).toContain("h'");
  });
});

describe('decodeCoseKey', () => {
  it('throws on invalid CBOR', () => {
    expect(() => decodeCoseKey(new Uint8Array([0xff]))).toThrow();
  });

  it('throws on non-map input', async () => {
    const { encode } = await import('cbor2');
    const arrayBytes = encode([1, 2, 3]);
    expect(() => decodeCoseKey(arrayBytes)).toThrow('must be a CBOR map');
  });

  it('throws on unsupported key type', async () => {
    const { encode } = await import('cbor2');
    const map = new Map<number, number>();
    map.set(1, 99); // Invalid kty
    const bytes = encode(map);
    expect(() => decodeCoseKey(bytes)).toThrow('Unsupported key type');
  });
});
