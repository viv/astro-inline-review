import { defineConfig } from 'tsup';

export default defineConfig([
  // Server/integration entry — Node APIs, not bundled
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['astro', 'vite', 'node:fs', 'node:fs/promises', 'node:path'],
  },
  // Client entry — browser code, fully bundled into a single file
  {
    entry: { client: 'src/client/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    // Bundle everything into one file — no external deps in the browser
    noExternal: [/.*/],
    platform: 'browser',
  },
]);
