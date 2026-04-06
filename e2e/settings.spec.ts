import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Settings — Hobby Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    // Clean up existing hobbies — delete one at a time with reload
    for (let i = 0; i < 10; i++) {
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')
      const actionButton = page.getByRole('button', { name: 'Hobby actions' }).first()
      if (!(await actionButton.isVisible({ timeout: 1000 }).catch(() => false))) break
      await actionButton.click()
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await page.getByRole('button', { name: 'Delete' }).click()
      await page.waitForTimeout(1000)
    }
  })

  test('settings page shows hobby management section', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Hobby Management')).toBeVisible()
  })

  test('shows empty state when no hobbies', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('No hobbies yet')).toBeVisible()
  })

  test('can add a hobby from settings', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill('Test Hobby')
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Test Hobby')).toBeVisible()
  })

  test('can edit a hobby from settings', async ({ page }) => {
    // Create hobby first
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill('Before Edit')
    await page.getByTitle('Sage').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Before Edit')).toBeVisible()

    // Edit
    await page.getByRole('button', { name: 'Hobby actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const input = page.getByPlaceholder('e.g., Woodworking')
    await input.clear()
    await input.fill('After Edit')
    await page.getByRole('button', { name: 'Save' }).click()
    // Wait for dialog to close and page to refresh
    await page.waitForTimeout(1000)
    await page.goto('/settings')
    await expect(page.getByText('After Edit')).toBeVisible()
  })

  test('can delete a hobby from settings', async ({ page }) => {
    // Create hobby first
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill('Delete Me')
    await page.getByTitle('Plum').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Delete Me')).toBeVisible()

    // Delete
    await page.getByRole('button', { name: 'Hobby actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('No hobbies yet')).toBeVisible()
  })
})
