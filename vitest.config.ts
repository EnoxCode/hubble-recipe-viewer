import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@hubble/sdk': path.resolve(__dirname, '__mocks__/@hubble/sdk.ts'),
      'hubble-sdk': path.resolve(__dirname, '__mocks__/@hubble/sdk.ts'),
      'hubble-ui': path.resolve(__dirname, '__mocks__/hubble-ui.ts'),
      'hubble-dash-ui': path.resolve(__dirname, '__mocks__/hubble-dash-ui.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
