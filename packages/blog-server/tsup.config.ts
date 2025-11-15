import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Disabled due to Next.js internal types
  clean: true,
  sourcemap: true,
  target: 'es2022',
  external: [
    'next',
    'next/headers',
    'next/server',
    'next/navigation',
    '@elkdonis/auth-server',
    '@elkdonis/db',
    '@elkdonis/types',
    '@elkdonis/utils',
    '@elkdonis/services',
  ],
});
