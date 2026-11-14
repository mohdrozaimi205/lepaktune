import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173/lepaktune/',
    launchOptions: { executablePath: process.env.CHROME_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required'] },
    channel: process.env.CHROME_PATH ? undefined : 'chrome',
  },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/lepaktune/', reuseExistingServer: true, timeout: 60000 },
});
