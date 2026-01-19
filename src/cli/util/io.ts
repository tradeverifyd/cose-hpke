// File I/O utilities for CLI

/**
 * Read a key file as binary
 */
export async function readKeyFile(path: string): Promise<Uint8Array> {
  const buffer = await Bun.file(path).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Read input from file or stdin
 * @param source - File path or "-" for stdin
 */
export async function readInput(source: string): Promise<Uint8Array> {
  if (source === '-') {
    // Read from stdin
    const chunks: Uint8Array[] = [];
    const reader = Bun.stdin.stream().getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Concatenate chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  return readKeyFile(source);
}

/**
 * Write binary data to file
 */
export async function writeOutput(path: string, data: Uint8Array): Promise<void> {
  await Bun.write(path, data);
}
