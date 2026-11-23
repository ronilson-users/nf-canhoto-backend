import { defineConfig } from 'vitest';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/integration/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});