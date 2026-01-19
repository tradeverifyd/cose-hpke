// encrypt command - encrypt a message for recipients

import { defineCommand } from 'citty';
import { encrypt } from '../../index.ts';
import { readKeyFile } from '../util/io.ts';
import { createShareableUrl } from '../util/url.ts';

export default defineCommand({
  meta: {
    name: 'encrypt',
    description: 'Encrypt a message for recipients',
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
      description: 'Recipient public key file (can repeat for multiple)',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output to file instead of URL',
    },
  },
  async run({ args }) {
    // Collect recipient keys (citty may provide single string or array)
    const recipientPaths = Array.isArray(args.recipient)
      ? args.recipient
      : [args.recipient];

    // Read all recipient public keys
    const recipientKeys: Uint8Array[] = [];
    for (const path of recipientPaths) {
      const key = await readKeyFile(path);
      recipientKeys.push(key);
    }

    // Encode message as bytes
    const plaintext = new TextEncoder().encode(args.message);

    // Encrypt
    const ciphertext = await encrypt(plaintext, recipientKeys);

    if (args.output) {
      // Write to file
      await Bun.write(args.output, ciphertext);
      console.log(`Encrypted message saved to: ${args.output}`);
    } else {
      // Output shareable URL
      const url = createShareableUrl(ciphertext);
      console.log(url);
    }
  },
});
