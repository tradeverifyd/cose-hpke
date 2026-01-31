// encrypt command - encrypt a message for recipients

import { defineCommand } from 'citty';
import { encrypt } from '../../index.ts';
import { readInput, readKeyFile } from '../util/io.ts';
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
    aad: {
      type: 'string',
      description: 'External AAD file path or "-" for stdin (COSE Enc_structure AAD)',
    },
    info: {
      type: 'string',
      description: 'Integrated encryption: external info file path or "-" for stdin',
    },
    'recipient-info': {
      type: 'string',
      description: 'Key encryption: recipient info file path or "-" for stdin (2+ recipients)',
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

    if (args.info && recipientKeys.length !== 1) {
      console.error('Error: --info is only valid for integrated encryption (1 recipient)');
      process.exit(1);
    }

    if (args['recipient-info'] && recipientKeys.length < 2) {
      console.error('Error: --recipient-info is only valid for key encryption (2+ recipients)');
      process.exit(1);
    }

    const externalAad = args.aad ? await readInput(args.aad) : undefined;
    const externalInfo = args.info ? await readInput(args.info) : undefined;
    const recipientExtraInfo = args['recipient-info']
      ? await readInput(args['recipient-info'])
      : undefined;

    // Encode message as bytes
    const plaintext = new TextEncoder().encode(args.message);

    // Encrypt with optional suite
    const ciphertext = await encrypt(plaintext, recipientKeys, {
      suiteId,
      externalAad,
      externalInfo,
      recipientExtraInfo,
    });

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
