import { defineConfig } from 'tsup';

const alias = {
  '@': './src',
};

export default defineConfig([
  {
    // One entry per experience. A single barrel would make every consumer pull
    // every scene in the package — the temple's shaders along with a mini-game.
    entry: [
      'src/index.ts',
      'src/endless-runner/index.ts',
      'src/inner-temple/index.ts',
      'src/gallery/index.ts',
      'src/hallway/index.ts',
    ],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2020',
    external: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
    ],
    banner: {
      js: "'use client';",
    },
    esbuildOptions(options) {
      options.alias = alias;
    },
  },
  // Plain data modules for server code: no 'use client' banner, which would
  // turn every export into a client reference a server action cannot call.
  // Built on its own (no chunks shared with the client entries, which carry the
  // banner) into its own directory, so neither build's clean step removes the
  // other's output.
  {
    entry: { 'hallway/model': 'src/hallway/model.ts' },
    outDir: 'dist-plain',
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2020',
    esbuildOptions(options) {
      options.alias = alias;
    },
  },
]);
