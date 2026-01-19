// keygen command - generate COSE-HPKE P-256 keypair

import { defineCommand } from 'citty';
import { generateKeyPair } from '../../cose/key.ts';
import { formatKeyOutput } from '../util/format.ts';

export default defineCommand({
  meta: {
    name: 'keygen',
    description: 'Generate a new COSE-HPKE P-256 keypair',
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
  },
  async run({ args }) {
    const { publicKey, privateKey } = await generateKeyPair();

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
      console.log(formatKeyOutput(publicKey, 'Public Key'));
      console.log('');
      console.log(formatKeyOutput(privateKey, 'Private Key'));
    }
  },
});
