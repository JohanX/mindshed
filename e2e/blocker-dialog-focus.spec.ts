import { test, expect, type Page } from '@playwright/test'
import { seedHobby, seedProject, seedInventoryItem, deleteHobbyCascade } from './helpers/db-seed'

// Story 25.3 — verifies focus restoration after the CreateBlockerDialog
// closes. Radix returns focus to the dialog's trigger by default, but the
// trigger here is a DropdownMenuItem that unmounts when the dialog opens —
// so without the onCloseAutoFocus override, focus falls to <body>.
//
// The fix wires the row's overflow `<Button aria-label="Actions for ...">`
// (which stays in the DOM) as the explicit focus target on dialog close.
test.describe.configure({ mode: 'serial' })

test.describe('CreateBlockerDialog focus restoration (Story 25.3)', () => {
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `BDF-${browserName}-${Date.now()}`
  })

  // Each test gets a fresh hobby + project + shortage row; full cleanup at
  // the end. Avoids cross-test state leakage (BOM rows persist per-project).
  async function setupShortageRow(page: Page, suffix: string) {
    const hobby = await seedHobby({
      name: `${testPrefix} ${suffix} Hobby`,
      color: 'hsl(15, 55%, 55%)',
    })
    const { project } = await seedProject({
      hobbyId: hobby.id,
      name: `${testPrefix} ${suffix} Project`,
      steps: [{ name: 'Step One', state: 'IN_PROGRESS' }],
    })
    const inventoryName = `${testPrefix}-${suffix}-Mat`
    await seedInventoryItem({
      name: inventoryName,
      type: 'MATERIAL',
      quantity: 5,
      unit: 'g',
      hobbyIds: [hobby.id],
    })

    const projectUrl = `/hobbies/${hobby.id}/projects/${project.id}`
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Add the BOM row + set required to 100 (qty=5 → row is short).
    await page.getByRole('button', { name: /Add item/ }).click()
    await page.getByPlaceholder('Type to search inventory…').fill(inventoryName)
    await page
      .getByRole('option', { name: new RegExp(inventoryName) })
      .first()
      .click()
    const row = page.locator('table tbody tr').filter({ hasText: inventoryName })
    const requiredInput = row.getByLabel('Required quantity')
    await requiredInput.fill('100')
    await requiredInput.blur()
    await expect(page.getByText('BOM item updated').first()).toBeVisible({ timeout: 5000 })

    return { hobbyId: hobby.id, inventoryName, row }
  }

  async function openDialog(page: Page, row: ReturnType<Page['locator']>, inventoryName: string) {
    await row.getByRole('button', { name: /Actions for / }).click()
    await page.getByRole('menuitem', { name: /Create blocker/ }).click()
    await expect(
      page.getByRole('heading', { name: new RegExp(`Block:.*${inventoryName}`) }),
    ).toBeVisible({ timeout: 5000 })
  }

  async function expectFocusOnTrigger(page: Page, inventoryName: string) {
    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.getAttribute('aria-label')), {
        timeout: 2000,
      })
      .toBe(`Actions for ${inventoryName}`)
  }

  test('Escape close restores focus to row overflow trigger', async ({ page }) => {
    test.setTimeout(60_000)
    const { hobbyId, inventoryName, row } = await setupShortageRow(page, 'Escape')
    try {
      await openDialog(page, row, inventoryName)
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('heading', { name: new RegExp(`Block:.*${inventoryName}`) }),
      ).toHaveCount(0, { timeout: 5000 })
      await expectFocusOnTrigger(page, inventoryName)
    } finally {
      await deleteHobbyCascade(hobbyId)
    }
  })

  test('Cancel close restores focus to row overflow trigger', async ({ page }) => {
    test.setTimeout(60_000)
    const { hobbyId, inventoryName, row } = await setupShortageRow(page, 'Cancel')
    try {
      await openDialog(page, row, inventoryName)
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(
        page.getByRole('heading', { name: new RegExp(`Block:.*${inventoryName}`) }),
      ).toHaveCount(0, { timeout: 5000 })
      await expectFocusOnTrigger(page, inventoryName)
    } finally {
      await deleteHobbyCascade(hobbyId)
    }
  })
})
