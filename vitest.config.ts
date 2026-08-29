import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web/src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: [
      'apps/api/src/__tests__/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
      'apps/web/src/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'apps/api/src/services/**/*.ts',
        'apps/api/src/controllers/**/*.ts',
        'apps/api/src/repositories/**/*.ts',
        'apps/api/src/routes/**/*.ts',
        'apps/api/src/middleware/**/*.ts',
        'apps/web/src/features/**/*.ts',
        'apps/web/src/lib/**/*.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});