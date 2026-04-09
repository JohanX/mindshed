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

    // Start the step via status dropdown
    const statusSelect = page.getByLabel('Step status').first()
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.click()
      await page.waitForTimeout(500)
      await page.getByRole('option', { name: /In Progress/ }).click()
      await page.waitForTimeout(1000)
    }

    await page.close()
  })

  test('can add a blocker to a step', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Blocker Test Project').first().click()
    await page.waitForLoadState('networkidle')

    // The current step should be expanded — click the blocker prompt
    const addBlockerBtn = page.getByText('Add a blocker...').first()
    await expect(addBlockerBtn).toBeVisible({ timeout: 5000 })
    await addBlockerBtn.click()

    await page.getByPlaceholder("Describe what's blocking this step...").fill('Waiting for materials')
    await page.getByRole('button', { name: 'Save' }).first().click()
    await page.waitForTimeout(1000)

    // Verify blocker appears and step shows Blocked
    await page.goto(page.url())
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Waiting for materials')).toBeVisible()
    await expect(page.getByText('Blocked').first()).toBeVisible()
  })

  test('can resolve a blocker', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Blocker Test Project').first().click()
    await page.waitForLoadState('networkidle')

    // The step is now BLOCKED — may not be auto-expanded. Expand it.
    const stepBtn = page.locator('button[aria-controls^="step-content-"]').first()
    const isExpanded = await stepBtn.getAttribute('aria-expanded')
    if (isExpanded === 'false') {
      await stepBtn.click()
      await page.waitForTimeout(500)
    }

    // Resolve the blocker
    const resolveBtn = page.getByRole('button', { name: 'Resolve' }).first()
    await resolveBtn.scrollIntoViewIfNeeded()
    await resolveBtn.click()
    await page.waitForTimeout(1000)

    // Verify blocker gone and step reverted from Blocked
    await page.goto(page.url())
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Waiting for materials')).not.toBeVisible()
    await expect(page.getByText('In Progress').first()).toBeVisible()
  })
})
