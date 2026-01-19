// Thin wrapper around cbor2 for CBOR encoding/decoding
import { encode, decode, diagnose } from 'cbor2';

export { encode, decode };

// Wrapper for diagnostic notation with error handling
export function toDiagnosticNotation(data: Uint8Array): string {
  return diagnose(data);
}
