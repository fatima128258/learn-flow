import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_WEB_PORT ? Number(process.env.E2E_WEB_PORT) : 3000;

export default defineConfig({
  testDir: './e2e/animation-specs',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
});
