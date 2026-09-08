import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ]
});
