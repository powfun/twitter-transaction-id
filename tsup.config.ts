import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: true,
  target: 'es2022',
  outDir: 'dist',
  esbuildOptions(options) {
    // Ensure compatibility with Cloudflare Workers
    options.conditions = ['worker', 'browser'];
  }
}); 