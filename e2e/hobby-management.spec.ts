import { test, expect } from '@playwright/test'

// Run serially — tests share database state
test.describe.configure({ mode: 'serial' })

test.describe('Hobby Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clean up hobbies one at a time with page reload between deletes
    for (let i = 0; i < 10; i++) {
      await page.goto('/hobbies')
      await page.waitForLoadState('networkidle')
      const actionButton = page.getByRole('button', { name: 'Hobby actions' }).first()
      if (!(await actionButton.isVisible({ timeout: 1000 }).catch(() => false))) break
      await actionButton.click()
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await page.getByRole('button', { name: 'Delete' }).click()
      await page.waitForTimeout(1000)
    }
  })

  test('shows empty state when no hobbies exist', async ({ page }) => {
    await page.goto('/hobbies')
    await expect(page.getByText('Welcome to MindShed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Hobby' }).first()).toBeVisible()
  })

  test('can create a hobby with name and color', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill('Woodworking')
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()

    // Wait for dialog to close and list to update
    await expect(page.getByText('Woodworking')).toBeVisible()
  })

  test('save button is disabled when name is empty', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByTitle('Terracotta').click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('first color is pre-selected by default', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    // Terracotta (first color) should be pre-selected — indicated by ring styling
    const firstColor = page.getByTitle('Terracotta')
    await expect(firstColor).toBeVisible()
    // With name filled, Save should be enabled (color already selected)
    await page.getByPlaceholder('e.g., Woodworking').fill('Test Hobby')
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  test('can edit a hobby via context menu', async ({ page }) => {
    // Create a hobby first
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill('Old Name')
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Old Name')).toBeVisible()

    // Open context menu and click Edit
    await page.getByRole('button', { name: 'Hobby actions' }).click()
    await page.getByText('Edit').click()

    // Change name
    const nameInput = page.getByPlaceholder('e.g., Woodworking')
    await nameInput.clear()
    await nameInput.fill('New Name')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('New Name')).toBeVisible()
    await expect(page.getByText('Old Name')).not.toBeVisible()
  })

  test('can delete a hobby via context menu', async ({ page }) => {
    // Create a hobby first
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill('To Delete')
    await page.getByTitle('Sage').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('To Delete')).toBeVisible()

    // Delete via context menu
    await page.getByRole('button', { name: 'Hobby actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Confirm
    await expect(page.getByText('Delete To Delete?')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()

    // Empty state should show
    await expect(page.getByText('Welcome to MindShed')).toBeVisible()
  })

  test('cancel on delete dialog does not delete', async ({ page }) => {
    // Create a hobby
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill('Keep Me')
    await page.getByTitle('Denim').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Keep Me')).toBeVisible()

    // Open delete dialog then cancel
    await page.getByRole('button', { name: 'Hobby actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Hobby still exists — check the card link (with project count to disambiguate from top bar)
    await expect(page.getByRole('link', { name: /Keep Me.*projects/ })).toBeVisible()
  })
})
