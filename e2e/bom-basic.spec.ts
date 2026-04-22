import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('BOM Basic CRUD', () => {
  let hobbyId: string
  let projectUrl: string
  let hobbyName: string

  test.beforeAll(async ({ browser, browserName }) => {
    hobbyName = `BOM-${browserName}-${Date.now()}`
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

    // Create a project so we have somewhere to attach a BOM
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Glaze Test')
    await page.getByPlaceholder('Step 1 name').fill('Weigh materials')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/hobbies\/.*\/projects\//, { timeout: 10000 })
    projectUrl = page.url()
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

  test('BOM section appears with empty state on a fresh project', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Bill of Materials' })).toBeVisible()
    await expect(page.getByText('0 items')).toBeVisible()
    await expect(page.getByText('Plan your materials before you start.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Add row/ })).toBeVisible()
  })

  test('can add via combobox Add-new, edit, and delete BOM rows; pill reflects state', async ({ page }, testInfo) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Unique per-browser prefixes — avoid colliding with the autocomplete spec's items
    const item1 = `BBC1-${testInfo.project.name}-${Date.now()}`
    const item2 = `BBC2-${testInfo.project.name}-${Date.now() + 1}`

    async function addViaCombobox(name: string, required: string, unit: string) {
      await page.getByRole('button', { name: /Add row/ }).click()
      const combobox = page.getByPlaceholder('Type to search inventory…')
      await combobox.fill(name)
      await page.getByRole('option', { name: new RegExp(`Add new "${name}"`) }).click()
      await expect(page.getByLabel('Inventory item name')).toBeVisible()
      await page.getByLabel('Starting qty').fill('1000') // ample stock → "ready"
      await page.getByLabel('Unit (optional)').fill(unit)
      await page.getByLabel('Required for this project').fill(required)
      await page.getByRole('button', { name: 'Save & add' }).click()
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 })
    }

    await addViaCombobox(item1, '500', 'g')
    await expect(page.getByText('1 item · ready')).toBeVisible()

    await addViaCombobox(item2, '200', 'g')
    await expect(page.getByText('2 items · ready')).toBeVisible()

    // Edit the first row's required quantity via blur save (desktop table row)
    const firstRowRequired = page.locator('table').getByLabel('Required quantity').first()
    await firstRowRequired.fill('10')
    await firstRowRequired.blur()
    await expect(page.getByText('BOM item updated').first()).toBeVisible({ timeout: 5000 })

    // Reload to confirm persisted value survived
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table').getByLabel('Required quantity').first()).toHaveValue('10')

    // Delete the second row via actions menu (desktop table scope)
    await page.locator('table').getByRole('button', { name: 'BOM row actions' }).last().click()
    await page.getByRole('menuitem', { name: 'Delete row' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(1000)

    await expect(page.getByText(item2)).toHaveCount(0)
    await expect(page.getByText('1 item · ready')).toBeVisible()
  })

  test('BOM section stays visible after archiving the project (AC #1)', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Archive the project via its actions menu
    await page.getByRole('button', { name: 'Project actions' }).click()
    await page.getByRole('menuitem', { name: 'Archive' }).click()
    await page.waitForTimeout(1500)

    // Navigate back — archived projects should still render the BOM section
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Bill of Materials' })).toBeVisible()
    await expect(page.getByText('1 item · ready')).toBeVisible()
  })
})
