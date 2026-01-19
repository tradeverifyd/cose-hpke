// COSE-HPKE library entry point

// Types
export type { KeyPair, CoseKeyMap } from './types/cose.ts';
export * from './types/cose.ts';
export * from './types/hpke.ts';

// COSE_Key operations
export {
  generateKeyPair,
  encodeCoseKey,
  decodeCoseKey,
  toDiagnostic,
} from './cose/key.ts';

// Errors
export { CoseError, InvalidKeyError, DecryptionError } from './errors.ts';
