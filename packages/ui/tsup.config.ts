import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2020',
  external: [
    'react',
    'react-dom',
    '@elkdonis/hooks',
    '@elkdonis/utils',
    '@elkdonis/types',
    '@mantine/core',
    '@mantine/hooks',
    '@mantine/form',
    '@mantine/dates',
    '@mantine/dropzone',
    '@mantine/tiptap',
    '@tabler/icons-react',
    '@tiptap/core',
    '@tiptap/pm',
    '@tiptap/react',
    '@tiptap/starter-kit',
    '@tiptap/extension-link',
    '@tiptap/extension-underline',
    'clsx',
    'lucide-react',
  ],
  banner: {
    js: "'use client';",
  },
  esbuildOptions(options) {
    options.alias = {
      '@': './src',
      '@repo/shadcn-ui': './src',
    };
  },
});
