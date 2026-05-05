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
    await expect(page.getByText('Material', { exact: true }).first()).toBeVisible()
  })

  test('can create a Tool item', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Add Item' }).first().click()
    // Wait for the Radix dialog open-animation to finish.
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Name').fill('Router Table')

    // Select Tool type. Scroll the trigger into view explicitly — under
    // parallel E2E load Playwright's auto-scroll has been seen to land
    // on a "not stable / outside viewport" loop while the dialog is
    // still settling.
    const typeTrigger = page.getByLabel('Type')
    await typeTrigger.scrollIntoViewIfNeeded()
    await typeTrigger.click()
    await page.getByRole('option', { name: 'Tool' }).click()

    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1000)

    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Router Table').first()).toBeVisible()
    await expect(page.getByText('Tool', { exact: true }).first()).toBeVisible()
  })

  test('filter tabs show correct items by type', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    // No filter active — both items visible by default
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

    // Click active Tools tab again to toggle off — both items visible again
    await page.getByRole('button', { name: 'Tools', exact: true }).click()
    await expect(page.getByText('Walnut Lumber').first()).toBeVisible()
    await expect(page.getByText('Router Table').first()).toBeVisible()
  })

  test('can edit an inventory item', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    // Click edit on the first item (aria-label now includes item name)
    await page
      .getByLabel(/^Edit /)
      .first()
      .click()
    await page.waitForTimeout(500)

    // Change the name
    const nameInput = page.getByLabel('Name')
    await nameInput.clear()
    await nameInput.fill('Updated Lumber')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Verify updated
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Updated Lumber').first()).toBeVisible()
  })

  test('can delete an inventory item with confirmation', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    // Capture the name of the first item so we can assert it specifically
    // disappears after delete. A previous version of this test compared
    // total card counts before/after, which flaked under parallel E2E
    // load when other specs created or deleted items in the shared test
    // DB between the two snapshots.
    const firstDeleteButton = page.getByLabel(/^Delete /).first()
    const ariaLabel = (await firstDeleteButton.getAttribute('aria-label')) ?? ''
    const itemName = ariaLabel.replace(/^Delete\s+/, '')
    expect(itemName).not.toBe('')

    await firstDeleteButton.click()
    await page.waitForTimeout(500)

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(1000)

    // Verify the specific item is gone.
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel(`Delete ${itemName}`)).toHaveCount(0)
  })

  test('auto-renames case-insensitive collisions and soft-deletes items', async ({
    page,
  }, testInfo) => {
    // Use a browser-unique base name so parallel browser suites don't collide.
    const base = `Kaolin-${testInfo.project.name}`
    const baseLower = base.toLowerCase()

    async function addItem(name: string) {
      await page.goto('/inventory')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Add Item' }).first().click()
      await page.getByLabel('Name').fill(name)
      // Type defaults to Material — acceptable for this story
      await page.getByRole('button', { name: 'Add Item' }).last().click()
      await page.waitForTimeout(1000)
    }

    // 1. First add — no collision, name is preserved
    await addItem(base)
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(base, { exact: true }).first()).toBeVisible()

    // 2. Case-insensitive collision — auto-renames to "(1)"
    await addItem(baseLower)
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(`${baseLower} (1)`, { exact: true }).first()).toBeVisible()

    // 3. Third collision — auto-renames to "(2)"
    await addItem(baseLower)
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(`${baseLower} (2)`, { exact: true }).first()).toBeVisible()

    // 4. Soft-delete the original — disappears from visible list
    const baseCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText(base, { exact: true }) })
    await expect(baseCard).toHaveCount(1)
    await baseCard.getByLabel(/^Delete /).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(1000)

    // 5. Reload — soft-deleted item stays absent; other two remain
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(base, { exact: true })).toHaveCount(0)
    await expect(page.getByText(`${baseLower} (1)`, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(`${baseLower} (2)`, { exact: true }).first()).toBeVisible()

    // 6. Because the unique index is partial on is_deleted=false, we can now
    //    re-add "Kaolin-<browser>" as a fresh item — no collision, no suffix.
    await addItem(base)
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(base, { exact: true }).first()).toBeVisible()
  })
})
