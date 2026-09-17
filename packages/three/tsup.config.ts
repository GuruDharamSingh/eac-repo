import { defineConfig } from 'tsup';

export default defineConfig({
  // One entry per experience. A single barrel would make every consumer pull
  // every scene in the package — the temple's shaders along with a mini-game.
  entry: [
    'src/index.ts',
    'src/endless-runner/index.ts',
    'src/inner-temple/index.ts',
    'src/gallery/index.ts',
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
    options.alias = {
      '@': './src',
    };
  },
});
