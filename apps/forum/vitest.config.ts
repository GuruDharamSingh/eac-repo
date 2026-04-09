import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts', // We'll create this file
    globals: true, // Allows using test functions without importing them
    css: true, // Supports CSS imports
  },
});
