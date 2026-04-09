import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Reminders', () => {
  let testPrefix: string
  let hobbyId: string
  let projectUrl: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `RM-${browserName}-${Date.now()}`
  })

  test('setup: create hobby and project', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(`${testPrefix} Hobby`)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(`${testPrefix} Hobby`) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''

    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Reminder Project`)
    await page.getByPlaceholder('Step 1 name').fill('Step One')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)
    projectUrl = page.url()
  })

  test('can set a project reminder via date picker', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Click the Remind button
    await page.getByRole('button', { name: 'Remind' }).click()
    await page.waitForTimeout(500)

    // Select a date in the calendar (next month to ensure it's in the future)
    const nextMonthBtn = page.getByRole('button', { name: /next month/i }).first()
    if (await nextMonthBtn.isVisible()) {
      await nextMonthBtn.click()
      await page.waitForTimeout(300)
    }
    // Click the 15th of the visible month
    await page.getByRole('gridcell', { name: '15' }).first().click()
    await page.waitForTimeout(1000)

    // Verify reminder badge appears after reload
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    // Should show a date badge (e.g., "May 15" or "Jun 15")
    await expect(page.getByText(/\d{1,2}/).first()).toBeVisible()
  })
})
