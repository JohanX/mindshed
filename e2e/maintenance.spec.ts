import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Equipment Maintenance', () => {
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `MT-${browserName}-${Date.now()}`
  })

  test('setup: create a Tool inventory item', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill(`${testPrefix} Table Saw`)

    // Select Tool type
    await page.getByLabel('Type').click()
    await page.getByRole('option', { name: 'Tool' }).click()

    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)
  })

  test('Tool item shows maintenance setup section', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    // The maintenance section should show "Set up maintenance schedule"
    await expect(page.getByText('Set up maintenance schedule').first()).toBeVisible()
  })

  test('Material item does NOT show maintenance section', async ({ page }) => {
    // Create a Material item
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill(`${testPrefix} Wood Glue`)
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)

    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    // Filter to Materials to isolate
    await page.getByRole('button', { name: 'Materials' }).click()
    await page.waitForTimeout(300)

    // Should NOT see maintenance setup
    const maintenanceText = page.getByText('Set up maintenance schedule')
    await expect(maintenanceText).not.toBeVisible()
  })

  test('can set maintenance interval on a Tool', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    // Filter to Tools
    await page.getByRole('button', { name: 'Tools', exact: true }).click()
    await page.waitForTimeout(300)

    // Fill in interval and click Set
    await page.getByPlaceholder('30').first().fill('60')
    await page.getByRole('button', { name: 'Set' }).first().click()
    await page.waitForTimeout(1000)

    // Verify maintenance info appears
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Tools', exact: true }).click()
    await page.waitForTimeout(300)

    await expect(page.getByText('Every 60 days').first()).toBeVisible()
  })

  test('can record maintenance on a Tool', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Tools', exact: true }).click()
    await page.waitForTimeout(300)

    await page.getByRole('button', { name: 'Record Maintenance' }).first().click()
    await page.waitForTimeout(1000)

    // After recording, should show "Last: [today's date]"
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Tools', exact: true }).click()
    await page.waitForTimeout(300)

    await expect(page.getByText(/Last:/).first()).toBeVisible()
  })
})
