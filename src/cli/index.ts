#!/usr/bin/env bun
// CLI entry point for COSE-HPKE

import { defineCommand, runMain } from 'citty';
import keygen from './commands/keygen.ts';
import encrypt from './commands/encrypt.ts';
import decrypt from './commands/decrypt.ts';

const main = defineCommand({
  meta: {
    name: 'cose-hpke',
    version: '0.1.0',
    description: 'COSE-HPKE encryption CLI - hybrid public key encryption with CBOR serialization',
  },
  subCommands: {
    keygen,
    encrypt,
    decrypt,
  },
});

runMain(main);
