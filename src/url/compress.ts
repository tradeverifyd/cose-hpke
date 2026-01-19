// Compression helpers using CompressionStream API (deflate-raw)

/**
 * Compress data using deflate-raw algorithm.
 * Returns compressed Uint8Array.
 */
export async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  // Cast required for Bun's TypeScript (BufferSource type issue)
  writer.write(data as BufferSource);
  writer.close();
  // Use Response pattern for Safari compatibility (not for-await iteration)
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

/**
 * Decompress deflate-raw compressed data.
 * Throws if data is corrupted or not valid deflate-raw.
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    // Cast required for Bun's TypeScript (BufferSource type issue)
    writer.write(data as BufferSource);
    writer.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  } catch (error) {
    throw new Error('Failed to decompress data: invalid or corrupted');
  }
}

/**
 * Check if CompressionStream is available.
 * Should always be true in modern Bun and browsers.
 */
export function isCompressionAvailable(): boolean {
  return typeof CompressionStream !== 'undefined';
}
