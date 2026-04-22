import { test, expect, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('BOM Shortage → Per-Row Create Blocker with Step Picker', () => {
  let hobbyId: string
  let hobbyName: string

  test.beforeAll(async ({ browser, browserName }) => {
    test.setTimeout(180_000)
    const stamp = Date.now()
    hobbyName = `BSH-${browserName}-${stamp}`
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

  async function createProjectWithSteps(
    page: Page,
    name: string,
    steps: string[],
  ): Promise<string> {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(name)
    await page.getByPlaceholder('Step 1 name').fill(steps[0])
    for (let i = 1; i < steps.length; i++) {
      await page.getByRole('button', { name: 'Add Step' }).click()
      await page.getByPlaceholder(`Step ${i + 1} name`).fill(steps[i])
    }
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/hobbies\/.*\/projects\//, { timeout: 10000 })
    return page.url()
  }

  async function addInventoryItem(page: Page, name: string, qty: string) {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill(name)
    await page.getByLabel('Quantity').fill(qty)
    await page.getByLabel('Unit').fill('g')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)
  }

  async function addBomLinkedRow(page: Page, itemName: string, required: string) {
    await expect(page.getByPlaceholder('Type to search inventory…')).toHaveCount(0)
    await page.getByRole('button', { name: /Add row/ }).click()
    const combobox = page.getByPlaceholder('Type to search inventory…')
    await expect(combobox).toBeVisible()
    await combobox.fill(itemName)
    await page
      .getByRole('option', { name: new RegExp(itemName) })
      .first()
      .click()
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 5000 })
    const row = page.locator('table tbody tr').filter({ hasText: itemName })
    const requiredInput = row.getByLabel('Required quantity')
    await requiredInput.fill(required)
    await requiredInput.blur()
    await expect(page.getByText('BOM item updated').first()).toBeVisible({ timeout: 5000 })
  }

  async function setStepState(page: Page, stepIndex: number, stateLabel: RegExp) {
    const statusSelect = page.getByLabel('Step status').nth(stepIndex)
    await statusSelect.click()
    await page.waitForTimeout(300)
    await page.getByRole('option', { name: stateLabel }).click()
    await page.waitForTimeout(800)
  }

  test('happy path + dedup + sufficient-row absence, all within one project', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(150_000)
    const stamp = Date.now()
    const shortMat = `ShortA-${browserName}-${stamp}`
    const ampleMat = `AmpleA-${browserName}-${stamp}`

    await addInventoryItem(page, shortMat, '5')
    await addInventoryItem(page, ampleMat, '1000')
    const projectUrl = await createProjectWithSteps(page, 'Shortage Happy Path', ['Prep', 'Fire'])

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await addBomLinkedRow(page, shortMat, '100')
    await addBomLinkedRow(page, ampleMat, '50')

    // Banner shows informational line, no CTA button
    await expect(page.getByText('1 item is short for this project.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Create blockers on Step/ })).toHaveCount(0)

    // Sufficient row has NO "Create blocker…" menu item
    const ampleRow = page.locator('table tbody tr').filter({ hasText: ampleMat })
    await ampleRow.getByRole('button', { name: /Actions for / }).click()
    await expect(page.getByRole('menuitem', { name: 'Create blocker…' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Short row — open dialog; default step is "Prep" (first NOT_STARTED, no IN_PROGRESS)
    const shortRow = page.locator('table tbody tr').filter({ hasText: shortMat })
    await shortRow.getByRole('button', { name: /Actions for / }).click()
    await page.getByRole('menuitem', { name: 'Create blocker…' }).click()
    await expect(
      page.getByRole('heading', { name: new RegExp(`Block:.*${shortMat}`) }),
    ).toBeVisible()
    const trigger = page.getByLabel('Target step')
    await expect(trigger).toContainText('Prep')

    await page.getByRole('button', { name: 'Create blocker', exact: true }).click()
    await expect(page.getByText(/Blocker created on Prep/)).toBeVisible({ timeout: 5000 })

    // Dashboard surfaces the blocker
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(new RegExp(`Need 100 g of .*${shortMat}`))).toBeVisible()

    // Dedup — second invocation from same row targeting Prep again → informational toast.
    // Note: after the first blocker, Prep is BLOCKED so the picker's default
    // shifts to Fire (first NOT_STARTED). Must explicitly select Prep.
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const shortRow2 = page.locator('table tbody tr').filter({ hasText: shortMat })
    await shortRow2.getByRole('button', { name: /Actions for / }).click()
    await page.getByRole('menuitem', { name: 'Create blocker…' }).click()
    await page.getByLabel('Target step').click()
    await page.getByRole('option', { name: /^Prep/ }).click()
    await page.getByRole('button', { name: 'Create blocker', exact: true }).click()
    await expect(page.getByText(/Already blocked on Prep/)).toBeVisible({ timeout: 5000 })
  })

  test('step picker excludes COMPLETED steps — original bug: first step completed', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(150_000)
    const stamp = Date.now()
    const shortMat = `ShortB-${browserName}-${stamp}`
    await addInventoryItem(page, shortMat, '5')
    const projectUrl = await createProjectWithSteps(page, 'Shortage CompletedFirst', [
      'Prep',
      'Fire',
    ])

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await addBomLinkedRow(page, shortMat, '100')

    // Mark Prep (step index 0) COMPLETED — this is the original bug scenario
    await setStepState(page, 0, /Completed/)

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Open dialog — picker defaults to "Fire"; Prep is absent from options
    const shortRow = page.locator('table tbody tr').filter({ hasText: shortMat })
    await shortRow.getByRole('button', { name: /Actions for / }).click()
    await page.getByRole('menuitem', { name: 'Create blocker…' }).click()
    const trigger = page.getByLabel('Target step')
    await expect(trigger).toContainText('Fire')

    await trigger.click()
    await expect(page.getByRole('option', { name: /^Prep/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Create blocker', exact: true }).click()
    await expect(page.getByText(/Blocker created on Fire/)).toBeVisible({ timeout: 5000 })
  })

  test('picker defaults to IN_PROGRESS step when one exists', async ({ page, browserName }) => {
    test.setTimeout(150_000)
    const stamp = Date.now()
    const shortMat = `ShortC-${browserName}-${stamp}`
    await addInventoryItem(page, shortMat, '5')
    const projectUrl = await createProjectWithSteps(page, 'Shortage InProgress', ['Prep', 'Fire'])

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await addBomLinkedRow(page, shortMat, '100')

    // Mark Fire (step index 1) IN_PROGRESS — picker should prefer it over Prep
    await setStepState(page, 1, /In Progress/)

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const shortRow = page.locator('table tbody tr').filter({ hasText: shortMat })
    await shortRow.getByRole('button', { name: /Actions for / }).click()
    await page.getByRole('menuitem', { name: 'Create blocker…' }).click()
    const trigger = page.getByLabel('Target step')
    await expect(trigger).toContainText('Fire')
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('all-steps-completed — picker disabled with clear message, submit disabled', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(150_000)
    const stamp = Date.now()
    const shortMat = `ShortD-${browserName}-${stamp}`
    await addInventoryItem(page, shortMat, '5')
    const projectUrl = await createProjectWithSteps(page, 'Shortage AllCompleted', ['Prep', 'Fire'])

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await addBomLinkedRow(page, shortMat, '100')

    // Complete both steps
    await setStepState(page, 0, /Completed/)
    await setStepState(page, 1, /Completed/)

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const shortRow = page.locator('table tbody tr').filter({ hasText: shortMat })
    await shortRow.getByRole('button', { name: /Actions for / }).click()
    await page.getByRole('menuitem', { name: 'Create blocker…' }).click()
    await expect(page.getByText(/All steps are completed — add a step first/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create blocker', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
