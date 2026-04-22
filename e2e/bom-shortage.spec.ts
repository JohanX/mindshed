import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('BOM Shortage Banner + Auto-Blocker', () => {
  let hobbyId: string
  let projectUrl: string
  let hobbyName: string
  let shortMat: string
  let ampleMat: string

  test.beforeAll(async ({ browser, browserName }) => {
    test.setTimeout(180_000)
    const stamp = Date.now()
    hobbyName = `BSH-${browserName}-${stamp}`
    shortMat = `ShortMat-${browserName}-${stamp}`
    ampleMat = `AmpleMat-${browserName}-${stamp}`
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })

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

    // Project with TWO steps — "Prep" and "Fire"
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Shortage Test')
    await page.getByPlaceholder('Step 1 name').fill('Prep')
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step 2 name').fill('Fire')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/hobbies\/.*\/projects\//, { timeout: 10000 })
    projectUrl = page.url()

    // Seed two inventory items
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill(shortMat)
    await page.getByLabel('Quantity').fill('5')
    await page.getByLabel('Unit').fill('g')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)

    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill(ampleMat)
    await page.getByLabel('Quantity').fill('1000')
    await page.getByLabel('Unit').fill('g')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)

    await page.close()
  })

  async function addBomLinkedRow(page: Parameters<Parameters<typeof test>[1]>[0]['page'], itemName: string, required: string) {
    await expect(page.getByPlaceholder('Type to search inventory…')).toHaveCount(0)
    await page.getByRole('button', { name: /Add row/ }).click()
    const combobox = page.getByPlaceholder('Type to search inventory…')
    await expect(combobox).toBeVisible()
    await combobox.fill(itemName)
    await page.getByRole('option', { name: new RegExp(itemName) }).first().click()
    // Row is added immediately with required=0; wait for it to appear, then
    // edit the required qty via blur-save on the inline input.
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 5000 })
    const row = page.locator('table tbody tr').filter({ hasText: itemName })
    const requiredInput = row.getByLabel('Required quantity')
    await requiredInput.fill(required)
    await requiredInput.blur()
    await expect(page.getByText('BOM item updated').first()).toBeVisible({ timeout: 5000 })
  }

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

  test('ShortageBanner appears with correct count and CTA, clicking creates blockers and mutes the button', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Add BOM rows first (moved out of beforeAll for resilience)
    await addBomLinkedRow(page, shortMat, '100')
    await addBomLinkedRow(page, ampleMat, '50')

    // Banner shows 1 short item with button targeting Step Prep
    await expect(page.getByText('1 item is short for this project.')).toBeVisible()
    const createBtn = page.getByRole('button', { name: /Create blockers on Step Prep/ })
    await expect(createBtn).toBeEnabled()

    await createBtn.click()
    // Toast confirms the create count
    await expect(page.getByText(/1 blocker added to Step Prep/)).toBeVisible({ timeout: 5000 })

    // Button mutes to "✓ Blockers created"
    await expect(page.getByRole('button', { name: /Blockers created/ })).toBeDisabled()

    // Dashboard should surface the new blocker via Active Blockers
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Need 100 g of .*ShortMat/)).toBeVisible()
  })

  test('banner re-enables when shortage set changes (required edited back into shortage)', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Button still muted for the existing fingerprint
    // Edit short row's required to 1 (no longer short — banner disappears)
    const shortRow = page
      .locator('table tbody tr')
      .filter({ hasText: shortMat })
    const req = shortRow.getByLabel('Required quantity')
    await req.fill('1')
    await req.blur()
    await expect(page.getByText('BOM item updated').first()).toBeVisible({ timeout: 5000 })

    // Banner gone
    await expect(page.getByText(/items are short for this project/)).toHaveCount(0)

    // Edit back to 100 — shortage set changes back, banner re-enabled
    await req.fill('100')
    await req.blur()
    await expect(page.getByText('BOM item updated').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('1 item is short for this project.')).toBeVisible()

    // Re-enabled CTA (fingerprint reset, no "Blockers created" state carried over)
    await expect(page.getByRole('button', { name: /Create blockers on Step Prep/ })).toBeEnabled()
  })
})
