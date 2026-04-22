import { test, expect, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('BOM Consumption (Mark / Undo) + Clone Integration', () => {
  let hobbyId: string
  let projectUrl: string
  let hobbyName: string
  let matName: string
  let toolName: string

  test.beforeAll(async ({ browser, browserName }) => {
    test.setTimeout(180_000)
    const stamp = Date.now()
    hobbyName = `BCO-${browserName}-${stamp}`
    matName = `ConsMat-${browserName}-${stamp}`
    toolName = `ConsTool-${browserName}-${stamp}`
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })

    // Hobby
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

    // Project
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Consumption Test')
    await page.getByPlaceholder('Step 1 name').fill('Mix')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/hobbies\/.*\/projects\//, { timeout: 10000 })
    projectUrl = page.url()

    // Seed two inventory items via the /inventory UI
    async function addInventory(name: string, qty: string, type: 'Material' | 'Tool') {
      await page.goto('/inventory')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Add Item' }).first().click()
      await page.getByLabel('Name').fill(name)
      if (type === 'Tool') {
        await page.getByLabel('Type').click()
        await page.getByRole('option', { name: 'Tool' }).click()
      }
      await page.getByLabel('Quantity').fill(qty)
      if (type === 'Material') await page.getByLabel('Unit').fill('g')
      await page.getByRole('button', { name: 'Add Item' }).last().click()
      await page.waitForTimeout(1000)
    }
    await addInventory(matName, '200', 'Material')
    await addInventory(toolName, '1', 'Tool')

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

  async function addBomLinkedRow(page: Page, itemName: string, required: string) {
    await expect(page.getByPlaceholder('Type to search inventory…')).toHaveCount(0)
    await page.getByRole('button', { name: /Add row/ }).click()
    const combobox = page.getByPlaceholder('Type to search inventory…')
    await expect(combobox).toBeVisible()
    await combobox.fill(itemName)
    await page.getByRole('option', { name: new RegExp(itemName) }).first().click()
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 5000 })
    const row = page.locator('table tbody tr').filter({ hasText: itemName })
    const requiredInput = row.getByLabel('Required quantity')
    await requiredInput.fill(required)
    await requiredInput.blur()
    await expect(page.getByText('BOM item updated').first()).toBeVisible({ timeout: 5000 })
  }

  test('Mark consumed → Undo cycle for a MATERIAL row, TOOL row hides the action', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Add MATERIAL row (required 50, available 200 → consume succeeds)
    await addBomLinkedRow(page, matName, '50')
    // Add TOOL row
    await addBomLinkedRow(page, toolName, '1')

    // === Scenario 1: Mark consumed on the MATERIAL row ===
    const matRow = page.locator('table tbody tr').filter({ hasText: matName })
    await matRow.getByRole('button', { name: 'BOM row actions' }).click()
    await page.getByRole('menuitem', { name: 'Mark consumed' }).click()
    await expect(page.getByText(`Marked ${matName} as consumed`)).toBeVisible({ timeout: 5000 })
    // Available cell shows "Consumed"
    await expect(matRow.getByText('Consumed', { exact: true })).toBeVisible()
    // Inventory decremented (200 - 50 = 150)
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    const matCard = page.locator('[data-slot="card"]').filter({ hasText: matName })
    await expect(matCard.getByText('150 g')).toBeVisible()

    // === Scenario 2: Undo ===
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const matRow2 = page.locator('table tbody tr').filter({ hasText: matName })
    await matRow2.getByRole('button', { name: /Undo/ }).click()
    await expect(page.getByText(`Reverted consumption of ${matName}`)).toBeVisible({ timeout: 5000 })
    // Available cell now shows "Reverted"
    await expect(matRow2.getByText('Reverted', { exact: true })).toBeVisible()
    // Inventory credited back
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    const matCard2 = page.locator('[data-slot="card"]').filter({ hasText: matName })
    await expect(matCard2.getByText('200 g')).toBeVisible()

    // === Scenario 3: Mark consumed hidden on TOOL row ===
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const toolRow = page.locator('table tbody tr').filter({ hasText: toolName })
    await toolRow.getByRole('button', { name: 'BOM row actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Mark consumed' })).toHaveCount(0)
    // Close the menu
    await page.keyboard.press('Escape')
  })

  test('clone project copies BOM rows with consumption state reset', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Clone the project — the existing project has 1 UNDONE row (ConsMat)
    // and 1 NOT_CONSUMED row (ConsTool)
    await page.getByRole('button', { name: 'Project actions' }).click()
    await page.getByRole('menuitem', { name: 'Clone' }).click()
    await expect(page.getByRole('heading', { name: /Consumption Test \(copy\)/ })).toBeVisible({
      timeout: 10000,
    })

    // Both rows appear, both with Available showing the "ok" sage check (NOT "Reverted" / "Consumed")
    await expect(page.getByText(matName).first()).toBeVisible()
    await expect(page.getByText(toolName).first()).toBeVisible()
    // Consumption-state chips must be absent on the clone
    await expect(page.getByText('Reverted', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Consumed', { exact: true })).toHaveCount(0)
    // Required inputs on cloned rows are NOT disabled (NOT_CONSUMED → editable)
    const cloneMatRow = page.locator('table tbody tr').filter({ hasText: matName })
    await expect(cloneMatRow.getByLabel('Required quantity')).toBeEnabled()
  })
})
