import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Inventory Management', () => {
  test('inventory page loads with Add Item button', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Item' }).first()).toBeVisible()
  })

  test('can create a Material item', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill('Walnut Lumber')
    // Type defaults to Material
    await page.getByLabel('Quantity').fill('10')
    await page.getByLabel('Unit').fill('boards')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)

    // Item should appear
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Walnut Lumber').first()).toBeVisible()
    await expect(page.getByText('Material', { exact: true })).toBeVisible()
  })

  test('can create a Tool item', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill('Router Table')

    // Select Tool type
    await page.getByLabel('Type').click()
    await page.getByRole('option', { name: 'Tool' }).click()

    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)

    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Router Table').first()).toBeVisible()
    await expect(page.getByText('Tool', { exact: true })).toBeVisible()
  })

  test('filter tabs show correct items by type', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    // All tab shows both items
    await expect(page.getByText('Walnut Lumber').first()).toBeVisible()
    await expect(page.getByText('Router Table').first()).toBeVisible()

    // Materials tab
    await page.getByRole('button', { name: 'Materials' }).click()
    await expect(page.getByText('Walnut Lumber').first()).toBeVisible()
    await expect(page.getByText('Router Table').first()).not.toBeVisible()

    // Tools tab
    await page.getByRole('button', { name: 'Tools', exact: true }).click()
    await expect(page.getByText('Router Table').first()).toBeVisible()
    await expect(page.getByText('Walnut Lumber')).not.toBeVisible()

    // All tab again
    await page.getByRole('button', { name: 'All' }).click()
    await expect(page.getByText('Walnut Lumber').first()).toBeVisible()
    await expect(page.getByText('Router Table').first()).toBeVisible()
  })
})
