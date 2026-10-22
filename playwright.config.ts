import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.ZETTA_TEST_URL || 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: {
      executablePath: process.env.ZETTA_BROWSER_PATH || undefined,
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.ZETTA_TEST_URL
    ? undefined
    : {
        command: 'npm run dev -- --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
      },
})
