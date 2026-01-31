// keygen command - generate COSE-HPKE keypair

import { defineCommand } from 'citty';
import { generateKeyPair } from '../../cose/key.ts';
import { formatKeyOutput } from '../util/format.ts';
import type { HpkeSuiteId } from '../../types/hpke.ts';
import { decode, encode } from '../../util/cbor.ts';
import { COSE_KEY_ALG } from '../../types/cose.ts';
import { getSuiteConfig } from '../../hpke/suite.ts';

export default defineCommand({
  meta: {
    name: 'keygen',
    description: 'Generate a new COSE-HPKE keypair',
  },
  args: {
    'output-public': {
      type: 'string',
      description: 'Save public key CBOR bytes to file',
    },
    'output-private': {
      type: 'string',
      description: 'Save private key CBOR bytes to file',
    },
    suite: {
      type: 'string',
      alias: 's',
      description: 'HPKE suite: HPKE-4 (X25519) or HPKE-7 (P-256, default)',
    },
    mode: {
      type: 'string',
      description: 'Key usage: encrypt0 (integrated, default) or encrypt (key encryption)',
    },
  },
  async run({ args }) {
    // Validate suite argument
    const suiteId = args.suite as HpkeSuiteId | undefined;
    if (suiteId && suiteId !== 'HPKE-4' && suiteId !== 'HPKE-7') {
      console.error(`Error: Invalid suite "${suiteId}". Use HPKE-4 or HPKE-7.`);
      process.exit(1);
    }

    const mode = args.mode ?? 'encrypt0';
    if (mode !== 'encrypt0' && mode !== 'encrypt') {
      console.error(`Error: Invalid mode "${mode}". Use encrypt0 or encrypt.`);
      process.exit(1);
    }

    let { publicKey, privateKey } = await generateKeyPair(suiteId);

    if (mode === 'encrypt') {
      const { keyEncryptionAlg } = getSuiteConfig(suiteId);
      const publicMap = decode(publicKey);
      const privateMap = decode(privateKey);
      if (!(publicMap instanceof Map) || !(privateMap instanceof Map)) {
        console.error('Error: Generated COSE_Key is not a map');
        process.exit(1);
      }
      publicMap.set(COSE_KEY_ALG, keyEncryptionAlg);
      privateMap.set(COSE_KEY_ALG, keyEncryptionAlg);
      publicKey = encode(publicMap);
      privateKey = encode(privateMap);
    }

    const outputPublicPath = args['output-public'];
    const outputPrivatePath = args['output-private'];

    // Handle file output if flags provided
    if (outputPublicPath) {
      await Bun.write(outputPublicPath, publicKey);
      console.log(`Public key saved to: ${outputPublicPath}`);
    }

    if (outputPrivatePath) {
      await Bun.write(outputPrivatePath, privateKey);
      console.log(`Private key saved to: ${outputPrivatePath}`);
    }

    // If neither output flag provided, display to console
    if (!outputPublicPath && !outputPrivatePath) {
      const suiteName = suiteId ?? 'HPKE-7';
      console.log(`Suite: ${suiteName}`);
      console.log(`Mode: ${mode}`);
      console.log('');
      console.log(formatKeyOutput(publicKey, 'Public Key'));
      console.log('');
      console.log(formatKeyOutput(privateKey, 'Private Key'));
    }
  },
});
