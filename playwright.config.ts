import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    viewport: { width: 1440, height: 1050 },
    launchOptions: {
      executablePath: process.env.BROWSER_EXECUTABLE || undefined,
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
