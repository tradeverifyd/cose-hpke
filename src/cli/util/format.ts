// Output formatting utilities for CLI

import { toDiagnostic } from '../../cose/key.ts';

/**
 * Format a CBOR-encoded key for console output.
 * Shows CDDL diagnostic notation and hex-encoded CBOR.
 *
 * @param keyBytes - CBOR-encoded COSE_Key bytes
 * @param label - Label for the output (e.g., "Public Key", "Private Key")
 * @returns Formatted string with diagnostic notation and hex
 */
export function formatKeyOutput(keyBytes: Uint8Array, label: string): string {
  const diagnostic = toDiagnostic(keyBytes);
  const hex = Buffer.from(keyBytes).toString('hex');

  return `${label}:
  ${diagnostic}

  CBOR (hex): ${hex}`;
}
