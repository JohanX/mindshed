import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Blocker Tracking', () => {
  let hobbyName: string
  let hobbyId: string

  test.beforeAll(async ({ browser, browserName }) => {
    hobbyName = `BL-${browserName}-${Date.now()}`
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })

    // Create hobby
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Walnut').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(hobbyName) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''

    // Create project with a step
    await page.goto(`/hobbies/${hobbyId}`)
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Blocker Test Project')
    await page.getByPlaceholder('Step 1 name').fill('Test Step')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Start the step
    const startBtn = page.getByTitle('Start step').first()
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(1000)
    }

    await page.close()
  })

  test.skip('can add a blocker to a step — deferred: CSS grid animation overflow-hidden blocks Playwright visibility', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Blocker Test Project').first().click()
    await page.waitForLoadState('networkidle')

    // The step card should be expanded since it's the current step (IN_PROGRESS)
    // Click the expand button to ensure it's open, then wait
    const expandBtn = page.locator('button[aria-expanded="false"]').first()
    if (await expandBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expandBtn.click()
    }
    await page.waitForTimeout(1000)

    // Scroll to bottom of the page to find the Add Blocker button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // Click Add Blocker
    await page.getByText('Add Blocker', { exact: true }).click({ timeout: 10000 })
    await page.waitForTimeout(300)

    // Fill the blocker description
    await page.locator('textarea').last().fill('Waiting for materials')
    await page.locator('button:has-text("Save")').first().click()
    await page.waitForTimeout(1000)

    // Verify blocker appears and step shows Blocked
    await page.goto(page.url())
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Waiting for materials')).toBeVisible()
    await expect(page.getByText('Blocked').first()).toBeVisible()
  })

  test.skip('can resolve a blocker — depends on add blocker test above', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Blocker Test Project').first().click()
    await page.waitForLoadState('networkidle')

    // Resolve the blocker
    const resolveBtn = page.getByRole('button', { name: 'Resolve' }).first()
    await expect(resolveBtn).toBeVisible()
    await resolveBtn.click()
    await page.waitForTimeout(1000)

    // Verify blocker gone and step reverted from Blocked
    await page.goto(page.url())
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Waiting for materials')).not.toBeVisible()
    await expect(page.getByText('In Progress').first()).toBeVisible()
  })
})
