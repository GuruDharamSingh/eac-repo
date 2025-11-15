import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Disable DTS for now due to Next.js type issues
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: [
    'react',
    'react-dom',
    'next',
    'next/link',
    'next/headers',
    'next/server',
    'next/navigation',
    '@mantine/core',
    '@supabase/auth-helpers-nextjs',
    '@supabase/auth-helpers-react',
    'date-fns',
    '@elkdonis/auth',
    '@elkdonis/db',
    '@elkdonis/services',
    '@elkdonis/types',
    '@elkdonis/ui',
    '@elkdonis/utils',
  ],
});
