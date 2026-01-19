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

    // Decrypt
    const plaintext = await decrypt(ciphertext, privateKey);

    // Output plaintext
    console.log(new TextDecoder().decode(plaintext));
  },
});
