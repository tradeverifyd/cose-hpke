// Build script for browser bundle
// Creates demo/lib.js for use in the web demo

const result = await Bun.build({
  entrypoints: ['./src/browser.ts'],
  outdir: './demo',
  naming: 'lib.js',
  target: 'browser',
  format: 'esm',
  minify: true,
  sourcemap: 'linked',
});

if (!result.success) {
  console.error('Build failed:');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log('Browser bundle created: demo/lib.js');
