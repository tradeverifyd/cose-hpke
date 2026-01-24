// keygen command - generate COSE-HPKE keypair

import { defineCommand } from 'citty';
import { generateKeyPair } from '../../cose/key.ts';
import { formatKeyOutput } from '../util/format.ts';
import type { HpkeSuiteId } from '../../types/hpke.ts';

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
  },
  async run({ args }) {
    // Validate suite argument
    const suiteId = args.suite as HpkeSuiteId | undefined;
    if (suiteId && suiteId !== 'HPKE-4' && suiteId !== 'HPKE-7') {
      console.error(`Error: Invalid suite "${suiteId}". Use HPKE-4 or HPKE-7.`);
      process.exit(1);
    }

    const { publicKey, privateKey } = await generateKeyPair(suiteId);

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
      console.log('');
      console.log(formatKeyOutput(publicKey, 'Public Key'));
      console.log('');
      console.log(formatKeyOutput(privateKey, 'Private Key'));
    }
  },
});
