import { test, expect } from '@playwright/test'
import {
  seedHobby,
  seedInventoryItem,
  deleteHobbyCascade,
  deleteInventoryItemsByPrefix,
  type SeededHobby,
} from './helpers/db-seed'

test.describe.configure({ mode: 'serial' })

test.describe('Inventory — Hobby Associations (Story 21.3)', () => {
  let hobbyA: SeededHobby
  let hobbyB: SeededHobby
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `IH-${browserName}-${Date.now()}`
    hobbyA = await seedHobby({ name: `${testPrefix} Woodworking`, color: 'hsl(25, 45%, 40%)' })
    hobbyB = await seedHobby({ name: `${testPrefix} Pottery`, color: 'hsl(15, 60%, 50%)' })
    await seedInventoryItem({ name: `${testPrefix} Plywood`, type: 'MATERIAL', quantity: 10, unit: 'sheets', hobbyIds: [hobbyA.id] })
    await seedInventoryItem({ name: `${testPrefix} Glaze`, type: 'CONSUMABLE', quantity: 2, unit: 'liters', hobbyIds: [hobbyB.id] })
    await seedInventoryItem({ name: `${testPrefix} Sandpaper`, type: 'CONSUMABLE', quantity: 50, unit: 'sheets' })
  })

  test.afterAll(async () => {
    await deleteInventoryItemsByPrefix(testPrefix)
    await deleteHobbyCascade(hobbyA.id)
    await deleteHobbyCascade(hobbyB.id)
  })

  test('hobby filter tabs appear and show all items by default', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: `${testPrefix} Woodworking` })).toBeVisible()
    await expect(page.getByRole('button', { name: `${testPrefix} Pottery` })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Untagged' })).toBeVisible()

    await expect(page.getByText(`${testPrefix} Plywood`).first()).toBeVisible()
    await expect(page.getByText(`${testPrefix} Glaze`).first()).toBeVisible()
    await expect(page.getByText(`${testPrefix} Sandpaper`).first()).toBeVisible()
  })

  test('hobby filter shows tagged + untagged items', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: `${testPrefix} Woodworking` }).click()

    await expect(page.getByText(`${testPrefix} Plywood`).first()).toBeVisible()
    await expect(page.getByText(`${testPrefix} Sandpaper`).first()).toBeVisible()
    await expect(page.getByText(`${testPrefix} Glaze`)).not.toBeVisible()
  })

  test('Untagged filter shows only zero-association items', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Untagged' }).click()

    await expect(page.getByText(`${testPrefix} Sandpaper`).first()).toBeVisible()
    await expect(page.getByText(`${testPrefix} Plywood`)).not.toBeVisible()
    await expect(page.getByText(`${testPrefix} Glaze`)).not.toBeVisible()
  })

  test('type + hobby filters AND together', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Consumables' }).click()
    await page.getByRole('button', { name: `${testPrefix} Woodworking` }).click()

    await expect(page.getByText(`${testPrefix} Sandpaper`).first()).toBeVisible()
    await expect(page.getByText(`${testPrefix} Plywood`)).not.toBeVisible()
    await expect(page.getByText(`${testPrefix} Glaze`)).not.toBeVisible()
  })

  test('hobby-colored badges appear on tagged inventory cards', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    const plywoodCard = page.locator('[data-slot="card"]').filter({
      has: page.getByText(`${testPrefix} Plywood`),
    })
    await expect(plywoodCard.getByText(`${testPrefix} Woodworking`)).toBeVisible()

    const sandpaperCard = page.locator('[data-slot="card"]').filter({
      has: page.getByText(`${testPrefix} Sandpaper`),
    })
    await expect(sandpaperCard.getByText(`${testPrefix} Woodworking`)).not.toBeVisible()
    await expect(sandpaperCard.getByText(`${testPrefix} Pottery`)).not.toBeVisible()
  })

  test('create dialog shows hobby toggle chips and tags item on save', async ({ page }) => {
    const itemName = `${testPrefix} New Wire`
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill(itemName)

    const hobbyChip = page.getByRole('switch', { name: `${testPrefix} Woodworking` })
    await expect(hobbyChip).toBeVisible()
    await expect(hobbyChip).toHaveAttribute('aria-checked', 'false')
    await hobbyChip.click()
    await expect(hobbyChip).toHaveAttribute('aria-checked', 'true')

    await expect(page.getByText('Leave empty = visible in all hobbies')).not.toBeVisible()

    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)

    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    const newCard = page.locator('[data-slot="card"]').filter({
      has: page.getByText(itemName),
    })
    await expect(newCard.getByText(`${testPrefix} Woodworking`)).toBeVisible()
  })

  test('edit dialog pre-populates hobby chips and can change them', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    const plywoodCard = page.locator('[data-slot="card"]').filter({
      has: page.getByText(`${testPrefix} Plywood`),
    })
    await plywoodCard.getByRole('button', { name: /^Edit / }).click()
    await page.waitForTimeout(500)

    const woodChip = page.getByRole('switch', { name: `${testPrefix} Woodworking` })
    const potteryChip = page.getByRole('switch', { name: `${testPrefix} Pottery` })
    await expect(woodChip).toHaveAttribute('aria-checked', 'true')
    await expect(potteryChip).toHaveAttribute('aria-checked', 'false')

    await potteryChip.click()
    await expect(potteryChip).toHaveAttribute('aria-checked', 'true')

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    const updatedCard = page.locator('[data-slot="card"]').filter({
      has: page.getByText(`${testPrefix} Plywood`),
    })
    await expect(updatedCard.getByText(`${testPrefix} Woodworking`)).toBeVisible()
    await expect(updatedCard.getByText(`${testPrefix} Pottery`)).toBeVisible()
  })

  test('switching hobby filters changes which items are visible', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    // After prior tests: Plywood=Woodworking+Pottery, Glaze=Pottery, Sandpaper=untagged, New Wire=Woodworking
    // Pottery filter hides Woodworking-only items (New Wire)
    await page.getByRole('button', { name: `${testPrefix} Pottery` }).click()
    await expect(page.getByText(`${testPrefix} Glaze`).first()).toBeVisible()

    // Woodworking filter hides Pottery-only items (Glaze)
    await page.getByRole('button', { name: `${testPrefix} Woodworking` }).click()
    await expect(page.getByText(`${testPrefix} Glaze`)).not.toBeVisible()
    await expect(page.getByText(`${testPrefix} Plywood`).first()).toBeVisible()
  })
})
