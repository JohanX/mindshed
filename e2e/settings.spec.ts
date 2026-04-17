import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Settings — Hobby Management', () => {
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `ST-${browserName}-${Date.now()}`
  })

  /** Find the "Hobby actions" button for a specific hobby by name pattern */
  function hobbyActionsButton(page: import('@playwright/test').Page, namePattern: RegExp) {
    return page
      .locator('div.relative')
      .filter({ has: page.getByRole('link', { name: namePattern }) })
      .getByRole('button', { name: 'Hobby actions' })
  }

  /** Click "Add Hobby" button scoped to main content */
  function addHobbyButton(page: import('@playwright/test').Page) {
    return page.locator('main').getByRole('button', { name: 'Add Hobby' }).first()
  }

  test('settings page shows hobby management section', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Hobby Management')).toBeVisible()
  })

  test('idle threshold setting: default value is 30 and can be updated', async ({ page }) => {
    await page.goto('/settings')
    const input = page.getByLabel('Idle threshold (days)')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('30')

    // Change to 45 and save
    await input.fill('45')
    const saveBtn = page.getByRole('button', { name: 'Save' })
    await saveBtn.click()

    // Reload and verify persisted
    await page.goto('/settings')
    await expect(page.getByLabel('Idle threshold (days)')).toHaveValue('45')

    // Restore to 30 for isolation
    await page.getByLabel('Idle threshold (days)').fill('30')
    await page.getByRole('button', { name: 'Save' }).click()
  })

  test('idle threshold setting: rejects values outside 1-365', async ({ page }) => {
    await page.goto('/settings')
    const input = page.getByLabel('Idle threshold (days)')
    await input.fill('0')
    await expect(page.getByText(/Enter a whole number between 1 and 365/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('can add a hobby from settings', async ({ page }) => {
    const hobbyName = `${testPrefix} Test Hobby`
    await page.goto('/settings')
    await addHobbyButton(page).click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).toBeVisible()
  })

  test('can edit a hobby from settings', async ({ page }) => {
    const hobbyName = `${testPrefix} Before Edit`
    const editedName = `${testPrefix} After Edit`
    await page.goto('/settings')
    await addHobbyButton(page).click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Sage').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).toBeVisible()

    await hobbyActionsButton(page, new RegExp(hobbyName)).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const input = page.getByPlaceholder('e.g., Woodworking')
    await input.clear()
    await input.fill(editedName)
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)
    await page.goto('/settings')
    await expect(page.getByRole('link', { name: new RegExp(`${editedName}.*projects`) })).toBeVisible()
  })

  test('can delete a hobby from settings', async ({ page }) => {
    const hobbyName = `${testPrefix} Delete Me`
    await page.goto('/settings')
    await addHobbyButton(page).click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Plum').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).toBeVisible()

    await hobbyActionsButton(page, new RegExp(hobbyName)).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(1000)

    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).not.toBeVisible()
  })
})
