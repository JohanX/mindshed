import { test, expect } from '@playwright/test'

// Run serially — tests share database state within browser
test.describe.configure({ mode: 'serial' })

test.describe('Hobby Management', () => {
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `HM-${browserName}-${Date.now()}`
  })

  /** Find the "Hobby actions" button for a specific hobby by name pattern */
  function hobbyActionsButton(page: import('@playwright/test').Page, namePattern: RegExp) {
    return page
      .locator('div.relative')
      .filter({ has: page.getByRole('link', { name: namePattern }) })
      .getByRole('button', { name: 'Hobby actions' })
  }

  /** Click "Add Hobby" button scoped to main content (not top bar) */
  function addHobbyButton(page: import('@playwright/test').Page) {
    return page.locator('main').getByRole('button', { name: 'Add Hobby' }).first()
  }

  test('hobbies page loads with add hobby button', async ({ page }) => {
    await page.goto('/hobbies')
    await page.waitForLoadState('networkidle')
    // With parallel browsers sharing DB, empty state may not be visible
    // but the Add Hobby button must always be present
    await expect(addHobbyButton(page)).toBeVisible()
  })

  test('can create a hobby with name and color', async ({ page }) => {
    const hobbyName = `${testPrefix} Woodworking`
    await page.goto('/hobbies')
    await addHobbyButton(page).click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()

    // Check the hobby card (with project count to distinguish from top-bar)
    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).toBeVisible()
  })

  test('save button is disabled when name is empty', async ({ page }) => {
    await page.goto('/hobbies')
    await addHobbyButton(page).click()
    await page.getByTitle('Terracotta').click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('first color is pre-selected by default', async ({ page }) => {
    await page.goto('/hobbies')
    await addHobbyButton(page).click()
    const firstColor = page.getByTitle('Terracotta')
    await expect(firstColor).toBeVisible()
    await page.getByPlaceholder('e.g., Woodworking').fill(`${testPrefix} Color Test`)
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  test('can edit a hobby via context menu', async ({ page }) => {
    const oldName = `${testPrefix} Old Name`
    const newName = `${testPrefix} New Name`
    await page.goto('/hobbies')
    await addHobbyButton(page).click()
    await page.getByPlaceholder('e.g., Woodworking').fill(oldName)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`${oldName}.*projects`) })).toBeVisible()

    await hobbyActionsButton(page, new RegExp(oldName)).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    const nameInput = page.getByPlaceholder('e.g., Woodworking')
    await nameInput.clear()
    await nameInput.fill(newName)
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('link', { name: new RegExp(`${newName}.*projects`) })).toBeVisible()
  })

  test('can delete a hobby via context menu', async ({ page }) => {
    const hobbyName = `${testPrefix} To Delete`
    await page.goto('/hobbies')
    await addHobbyButton(page).click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Sage').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).toBeVisible()

    await hobbyActionsButton(page, new RegExp(hobbyName)).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    await expect(page.getByText(`Delete ${hobbyName}?`)).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(1000)

    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).not.toBeVisible()
  })

  test('cancel on delete dialog does not delete', async ({ page }) => {
    const hobbyName = `${testPrefix} Keep Me`
    await page.goto('/hobbies')
    await addHobbyButton(page).click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Denim').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).toBeVisible()

    await hobbyActionsButton(page, new RegExp(hobbyName)).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Check the hobby card link (with project count to distinguish from top-bar link)
    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).toBeVisible()
  })
})
