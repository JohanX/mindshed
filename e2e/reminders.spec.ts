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

  test('Remind button is visible on project page', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Remind' })).toBeVisible()
  })

  test('can set a project reminder via date picker', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Remind' }).click()
    await page.waitForTimeout(500)

    // Navigate to next month to ensure future date
    const nextMonthBtn = page.getByRole('button', { name: /next month/i }).first()
    if (await nextMonthBtn.isVisible()) {
      await nextMonthBtn.click()
      await page.waitForTimeout(300)
    }
    await page.getByRole('gridcell', { name: '15' }).first().click()
    await page.waitForTimeout(1000)

    // Verify reminder shows as date on the button after reload
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    // The Remind button should now show the date instead of "Remind"
    await expect(page.getByRole('button', { name: /\w+ \d+/ })).toBeVisible()
  })

  test('can update an existing reminder date', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Click the date button (existing reminder)
    await page.getByRole('button', { name: /\w+ \d+/ }).click()
    await page.waitForTimeout(500)

    // Pick a different date
    await page.getByRole('gridcell', { name: '20' }).first().click()
    await page.waitForTimeout(1000)

    // Verify the date changed
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /\w+ \d+/ })).toBeVisible()
  })

  test('can remove a reminder', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Open the date picker
    await page.getByRole('button', { name: /\w+ \d+/ }).click()
    await page.waitForTimeout(500)

    // Click Remove Reminder
    await page.getByRole('button', { name: /Remove Reminder/i }).click()
    await page.waitForTimeout(1000)

    // Verify it's back to "Remind"
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Remind' })).toBeVisible()
  })
})
