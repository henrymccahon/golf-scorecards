import { defineConfig, devices } from '@playwright/test';

declare const process: {
  env: Record<string, string | undefined>;
};

export default defineConfig({
  testDir: './e2e',
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER ? undefined : {
    command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] }
    }
  ]
});
