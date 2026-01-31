// decrypt command - decrypt a COSE-HPKE message

import { defineCommand } from 'citty';
import { decrypt } from '../../index.ts';
import { readKeyFile, readInput } from '../util/io.ts';
import { parseShareableUrl, isUrl } from '../util/url.ts';

export default defineCommand({
  meta: {
    name: 'decrypt',
    description: 'Decrypt a COSE-HPKE message',
  },
  args: {
    input: {
      type: 'positional',
      description: 'URL, file path, or - for stdin',
      required: true,
    },
    key: {
      type: 'string',
      alias: 'k',
      description: 'Private key file',
      required: true,
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
      description: 'Key encryption: recipient info file path or "-" for stdin',
    },
  },
  async run({ args }) {
    // Read private key
    const privateKey = await readKeyFile(args.key);

    // Determine input source and get ciphertext
    let ciphertext: Uint8Array;

    if (isUrl(args.input)) {
      // Parse URL fragment (handles both versioned and legacy formats)
      try {
        ciphertext = await parseShareableUrl(args.input);
      } catch (error) {
        console.error('Error: Invalid URL or missing fragment');
        process.exit(1);
      }
    } else {
      // Read from file or stdin
      ciphertext = await readInput(args.input);
    }

    const externalAad = args.aad ? await readInput(args.aad) : undefined;
    const externalInfo = args.info ? await readInput(args.info) : undefined;
    const recipientExtraInfo = args['recipient-info']
      ? await readInput(args['recipient-info'])
      : undefined;

    // Decrypt
    const plaintext = await decrypt(ciphertext, privateKey, {
      externalAad,
      externalInfo,
      recipientExtraInfo,
    });

    // Output plaintext
    console.log(new TextDecoder().decode(plaintext));
  },
});
