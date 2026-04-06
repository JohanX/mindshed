import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load .env.test for E2E tests (separate test database)
dotenv.config({ path: path.resolve(__dirname, '.env.test') })

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.CI ? 'http://localhost:3000' : 'http://localhost:3001',
    trace: 'on-first-retry',
    storageState: 'e2e/.auth/state.json',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { storageState: undefined },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: process.env.CI
      ? 'pnpm build && pnpm start'
      : 'pnpm dev --port 3001',
    url: process.env.CI ? 'http://localhost:3000' : 'http://localhost:3001',
    reuseExistingServer: false,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL!,
      APP_SECRET: process.env.APP_SECRET ?? '',
    },
  },
})
