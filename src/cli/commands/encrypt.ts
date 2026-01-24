// encrypt command - encrypt a message for recipients

import { defineCommand } from 'citty';
import { encrypt } from '../../index.ts';
import { readKeyFile } from '../util/io.ts';
import { createShareableUrl, UrlTooLargeError } from '../util/url.ts';
import type { HpkeSuiteId } from '../../types/hpke.ts';

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

    // Encrypt with optional suite
    const ciphertext = await encrypt(plaintext, recipientKeys, { suiteId });

    if (args.output) {
      // Write to file
      await Bun.write(args.output, ciphertext);
      console.log(`Encrypted message saved to: ${args.output}`);
    } else {
      // Output shareable URL (with compression)
      try {
        const url = await createShareableUrl(ciphertext);
        console.log(url);
      } catch (error) {
        if (error instanceof UrlTooLargeError) {
          console.error(`Error: ${error.message}`);
          console.error('Use --output flag to save to file instead.');
          process.exit(1);
        }
        throw error;
      }
    }
  },
});
