import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  // @elkdonis/services ships TypeScript source (it is transpiled by whichever
  // app consumes it). This package ships dist, so it must BUNDLE that source
  // rather than leave an import node could not resolve at runtime.
  noExternal: ['@elkdonis/services'],
});
