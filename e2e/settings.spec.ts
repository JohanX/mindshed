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
