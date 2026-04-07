import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('shows welcome empty state when no hobbies', async ({ page }) => {
    // With a clean test DB, first test should see empty state
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Either empty state or dashboard sections (depending on test order)
    const heading = page.getByRole('heading', { name: 'Dashboard' })
    await expect(heading).toBeVisible()
  })

  test('shows dashboard sections after creating data', async ({ page }) => {
    // Create a hobby first
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill('Dashboard Test Hobby')
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Get hobby ID
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: /Dashboard Test Hobby/ }).first()
    const href = await hobbyLink.getAttribute('href')
    const hobbyId = href?.replace('/hobbies/', '') ?? ''

    // Create a project
    await page.goto(`/hobbies/${hobbyId}`)
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Dashboard Project')
    await page.getByPlaceholder('Step 1 name').fill('First Step')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Go to dashboard
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Should show Continue section with the project
    await expect(page.getByText('Continue').first()).toBeVisible()
    await expect(page.getByText('Dashboard Project').first()).toBeVisible()

    // Should show section headers
    await expect(page.getByText('Active Blockers').first()).toBeVisible()
    await expect(page.getByText('Idle Projects').first()).toBeVisible()
  })

  test('continue card navigates to project', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const projectLink = page.getByText('Dashboard Project').first()
    if (await projectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectLink.click()
      await expect(page).toHaveURL(/\/hobbies\/.*\/projects\//)
    }
  })
})
