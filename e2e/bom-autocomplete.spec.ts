import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('BOM Autocomplete + Inline Inventory Creation', () => {
  let hobbyId: string
  let projectUrl: string
  let hobbyName: string
  let materialName: string
  let newItemName: string

  test.beforeAll(async ({ browser, browserName }) => {
    const stamp = Date.now()
    hobbyName = `BAC-${browserName}-${stamp}`
    materialName = `TestMat-${browserName}-${stamp}`
    newItemName = `BrandNew-${browserName}-${stamp}`
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })

    // Create hobby
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Walnut').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(hobbyName) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''

    // Create a project
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Glaze Run')
    await page.getByPlaceholder('Step 1 name').fill('Weigh dry')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/hobbies\/.*\/projects\//, { timeout: 10000 })
    projectUrl = page.url()

    // Seed one inventory item so the combobox has data
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill(materialName)
    await page.getByLabel('Quantity').fill('100')
    await page.getByLabel('Unit').fill('g')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)

    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const actionButton = page
      .locator('div.relative')
      .filter({ has: page.getByRole('link', { name: new RegExp(hobbyName) }) })
      .getByRole('button', { name: 'Hobby actions' })

    if (await actionButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionButton.click()
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await page.getByRole('button', { name: 'Delete' }).click()
      await page.waitForTimeout(1000)
    }
    await page.close()
  })

  test('pick existing inventory item via combobox — row added immediately with 0 required', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /Add row/ }).click()
    const combobox = page.getByPlaceholder('Type to search inventory…')
    await expect(combobox).toBeVisible()
    await combobox.fill(materialName.slice(0, 8)) // partial prefix

    const option = page.getByRole('option', { name: new RegExp(materialName) })
    await expect(option).toBeVisible()
    await option.click()

    // Row is added immediately with required=0 — no intermediate form
    await expect(page.getByText(materialName).first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('table').getByLabel('Required quantity').first()).toHaveValue('0')
    // Pill reads "1 items · 1 short" because 0 required with available 100 is not short
    // — but item is linked with qty. Actually required=0 < available=100, so NOT short.
    await expect(page.getByText('1 item · ready')).toBeVisible()
  })

  test('already-linked item is hidden from subsequent combobox', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /Add row/ }).click()
    const combobox = page.getByPlaceholder('Type to search inventory…')
    await combobox.fill(materialName.slice(0, 8))

    // Already-linked items are filtered out of the combobox (post-Epic-16 UX fix)
    const option = page.getByRole('option', { name: new RegExp(`^${materialName}$`) })
    await expect(option).toHaveCount(0)

    await page.keyboard.press('Escape')
  })

  test('add new inventory item via combobox → persists to /inventory and BOM', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /Add row/ }).click()
    const combobox = page.getByPlaceholder('Type to search inventory…')
    await combobox.fill(newItemName)

    // "Add new" option visible when no exact match
    const addNew = page.getByRole('option', { name: new RegExp(`Add new "${newItemName}"`) })
    await expect(addNew).toBeVisible()
    await addNew.click()

    // Inline new-inventory form appears
    await expect(page.getByLabel('Inventory item name')).toHaveValue(newItemName)
    // Type defaults to Material — set starting qty 0, unit g, required 10
    await page.getByLabel('Starting qty').fill('0')
    await page.getByLabel('Unit (optional)').fill('g')
    await page.getByLabel('Required for this project').fill('10')
    await page.getByRole('button', { name: 'Save & add' }).click()
    await page.waitForTimeout(1500)

    await expect(page.getByText(newItemName).first()).toBeVisible({ timeout: 5000 })
    // Pill reflects two items now — one ready (TestMat), one short (brand new, qty 0 < req 10)
    await expect(page.getByText('2 items · 1 short')).toBeVisible()

    // Inventory page should also have the new item
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(newItemName).first()).toBeVisible()
  })

  test('Escape closes the combobox without persisting', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const rowCountBefore = await page.locator('table tbody tr').count()

    await page.getByRole('button', { name: /Add row/ }).click()
    const combobox = page.getByPlaceholder('Type to search inventory…')
    await combobox.fill('random typed text')
    await combobox.press('Escape')

    // Combobox should be gone
    await expect(page.getByPlaceholder('Type to search inventory…')).toHaveCount(0)

    const rowCountAfter = await page.locator('table tbody tr').count()
    expect(rowCountAfter).toBe(rowCountBefore)
  })
})
