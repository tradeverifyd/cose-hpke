// Independent upstream vectors pinned to cose-wg/draft-ietf-cose-hpke PR #155,
// commit 8cef948f1d8173ec4a21da61ba40a449fa1bcfb7 (includes draft-27 PSK cases).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decode, encode, Tag } from 'cbor2';
import { decrypt } from '../src/index.ts';
const vectors = JSON.parse(readFileSync(new URL('./fixtures/pr155.json', import.meta.url), 'utf8'));
const bytes = (s: string) => new TextEncoder().encode(s);
const psk = Uint8Array.from(Buffer.from('0247fd33b913760fa1fa51e1892d9f307fbe65eb171e8132c2af18555a738b82', 'hex'));
const privateKey = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));
for (const v of vectors) {
 test(v.name, async () => {
  const options = {
   externalAad: v.name.includes('external aad') ? bytes('external-aad') : undefined,
   externalInfo: v.name.includes('external info') ? bytes('external-info') : undefined,
   recipientExtraInfo: v.name.includes('external info') ? bytes('external-info') : undefined,
   hpkeAad: v.name.includes('external hpke aad') ? bytes('external-hpke-aad') : undefined,
   psk: v.name.includes('PSK') ? psk : undefined,
  };
  const ciphertext = Uint8Array.from(Buffer.from(v.ciphertext, 'hex'));
  const body = (decode(ciphertext) as Tag).contents as any[];
  if (v.name.includes('-KE')) assert.equal(body[1].get(5).length, 12);
  assert.equal(new TextDecoder().decode(await decrypt(ciphertext, privateKey(v.key), options)), 'hpke test payload');
  if (v.name.includes('PSK')) {
   await assert.rejects(() => decrypt(ciphertext, privateKey(v.key), {...options, psk: undefined}));
   await assert.rejects(() => decrypt(ciphertext, privateKey(v.key), {...options, psk: new Uint8Array(32)}));
  }
 });
}

test('rejects non-96-bit IVs from the pre-PR155 vectors', async () => {
 const v = vectors.find((v: any) => v.name.startsWith('HPKE-7-KE with default aad, default info, default hpke aad'));
 for (const length of [0, 8, 16, 32]) {
  const tagged = decode(Uint8Array.from(Buffer.from(v.ciphertext, 'hex'))) as Tag;
  (tagged.contents as any[])[1].set(5, new Uint8Array(length));
  await assert.rejects(() => decrypt(encode(tagged), privateKey(v.key)), /IV must be 12 bytes/);
 }
});
test('rejects unprotected psk_id', async () => {
 const v = vectors.find((v: any) => v.name.startsWith('HPKE-7 Encrypt0 with default aad and default info'));
 const tagged = decode(Uint8Array.from(Buffer.from(v.ciphertext, 'hex'))) as Tag;
 (tagged.contents as any[])[1].set(-5, bytes('unprotected'));
 await assert.rejects(() => decrypt(encode(tagged), privateKey(v.key)), /psk_id must be protected/);
});

import { encrypt } from '../src/index.ts';
import { toJwk, fromJwk } from '../src/cose/key.ts';
test('PSK round trips through the public API in both modes', async () => {
 const v = vectors.find((v: any) => v.name.startsWith('HPKE-7 Encrypt0 with default aad and default info'));
 const priv = privateKey(v.key);
 const jwk = await toJwk(priv); delete jwk.d;
 const pub = await fromJwk(jwk);
 const options = { psk, pskId: bytes('roundtrip'), externalInfo: bytes('info'), recipientExtraInfo: bytes('info'), hpkeAad: bytes('wrap-aad') };
 for (const recipients of [[pub], [pub, pub]]) {
  const ct = await encrypt(bytes('roundtrip'), recipients, options);
  assert.equal(new TextDecoder().decode(await decrypt(ct, priv, options)), 'roundtrip');
 }
});

test('rejects wrong-mode and unknown integrated algorithms', async () => {
 const v = vectors.find((v: any) => v.name.startsWith('HPKE-7 Encrypt0 with default aad and default info'));
 for (const alg of [53, -1, 999]) {
  const tagged = decode(Uint8Array.from(Buffer.from(v.ciphertext, 'hex'))) as Tag;
  const body = tagged.contents as any[];
  body[0] = encode(new Map([[1, alg]]));
  await assert.rejects(() => decrypt(encode(tagged), privateKey(v.key)), /[Ii]ntegrated/);
 }
});
