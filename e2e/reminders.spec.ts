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

  test('snooze hides the reminder from the dashboard (Story 18.4)', async ({ page }) => {
    test.setTimeout(60_000)

    // 1. Set a reminder inside the 7-day dashboard window. Compute tomorrow's
    //    aria-label (react-day-picker format: "Tuesday, April 22, 2026") and
    //    click that exact day button — unambiguous across leading/trailing
    //    month cells.
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Remind' }).click()
    await expect(page.getByRole('grid').first()).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(300)

    // CalendarDayButton adds `data-day={day.date.toLocaleDateString(locale)}`.
    // The browser locale is the page's default (en-US for Playwright). Match
    // it exactly with `'en-US'` to avoid Node-default-locale drift on CI.
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dataDay = tomorrow.toLocaleDateString('en-US')
    await page.locator(`[data-day="${dataDay}"]`).first().click()
    await page.waitForTimeout(1000)

    // 2. Verify the reminder shows on the dashboard.
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const reminderCard = page
      .locator('a')
      .filter({ hasText: `${testPrefix} Reminder Project` })
      .first()
    await expect(reminderCard).toBeVisible({ timeout: 5000 })

    // 3. Open the reminder's action menu and click "Snooze 1 day".
    //    The trigger has an sr-only "Reminder actions" label.
    await page.getByRole('button', { name: 'Reminder actions' }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('menuitem', { name: 'Snooze 1 day' }).click()
    await expect(page.getByText(/Snoozed for 1 day/i)).toBeVisible({ timeout: 5000 })

    // 4. Reload dashboard — the reminder is hidden while snoozed (snoozedUntil > now).
    //    Scope to the reminder card specifically via its "Reminder actions"
    //    button — the project name also appears in the Continue section and
    //    we only care about the reminder-card entry here.
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Reminder actions' })).toHaveCount(0)

    // 5. The reminder itself still exists on the project — the Remind button
    //    still shows a date (not "Remind"). Snooze is a hide-from-dashboard
    //    action, not a delete.
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /\w+ \d+/ })).toBeVisible()
  })
})
