import { test as setup } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  const secret = process.env.APP_SECRET
  if (secret) {
    await page.goto(`/?token=${secret}`)
    // Wait for redirect to complete — middleware sets cookie and redirects to /
    await page.waitForLoadState('networkidle')
  } else {
    await page.goto('/')
  }
  await page.context().storageState({ path: 'e2e/.auth/state.json' })
})
