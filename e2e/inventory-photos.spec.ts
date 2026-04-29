import { test, expect } from '@playwright/test'
import {
  seedHobby,
  seedProject,
  seedInventoryItem,
  seedInventoryItemImage,
  deleteHobbyCascade,
  deleteInventoryItemsByPrefix,
  type SeededHobby,
  type SeededInventoryItem,
} from './helpers/db-seed'

test.describe('Inventory Photos (Story 21.2)', () => {
  test.describe.configure({ mode: 'serial' })
  let hobby: SeededHobby
  let item: SeededInventoryItem
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `IP-${browserName}-${Date.now()}`
    hobby = await seedHobby({ name: `${testPrefix} Hobby`, color: 'hsl(200, 60%, 50%)' })
    item = await seedInventoryItem({
      name: `${testPrefix} Clay`,
      type: 'MATERIAL',
      quantity: 5,
      unit: 'kg',
    })
  })

  test.afterAll(async () => {
    await deleteInventoryItemsByPrefix(testPrefix)
    await deleteHobbyCascade(hobby.id)
  })

  test('edit dialog shows Photos section with upload and link buttons', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: `Edit ${testPrefix} Clay` }).click()
    await expect(page.getByTestId('photos-section')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible()
    await expect(page.getByTestId('image-form-inputs-link-prompt')).toBeVisible()
    await expect(page.getByText('No photos yet')).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
  })

  test('add a URL photo via Paste Image / Link', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: `Edit ${testPrefix} Clay` }).click()
    await expect(page.getByTestId('photos-section')).toBeVisible()

    await page.getByTestId('image-form-inputs-link-prompt').click()
    await page.getByPlaceholder('Paste image or URL').fill('https://picsum.photos/200/200')
    await page.getByTestId('photos-section').getByRole('button', { name: 'Save' }).click()

    await expect(page.getByTestId('photo-grid')).toBeVisible({ timeout: 5000 })
    const thumbnails = page.getByTestId('photo-grid').locator('img')
    await expect(thumbnails).toHaveCount(1)

    await page.getByRole('button', { name: 'Close' }).click()
  })

  test('hero thumbnail appears on inventory card after adding photo', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    const heroButton = page.getByRole('button', { name: `View photos of ${testPrefix} Clay` })
    await expect(heroButton).toBeVisible()
    const heroImg = heroButton.locator('img')
    await expect(heroImg).toBeVisible()
  })

  test('lightbox opens when clicking hero thumbnail', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: `View photos of ${testPrefix} Clay` }).click()

    await expect(page.getByTestId('image-lightbox')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('lightbox-counter')).toContainText('1 of 1')

    await page.getByTestId('lightbox-close').click()
    await expect(page.getByTestId('image-lightbox')).not.toBeVisible()
  })

  test('delete a photo from the edit dialog', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: `Edit ${testPrefix} Clay` }).click()
    await expect(page.getByTestId('photo-grid')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'Delete photo' }).first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText('Delete this photo?')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('No photos yet')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Close' }).click()
  })

  test('hero thumbnail disappears after last photo is deleted', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    const heroButton = page.getByRole('button', { name: `View photos of ${testPrefix} Clay` })
    await expect(heroButton).not.toBeVisible()
  })

  test('create inventory item with pasted-link photo (FR121 parity)', async ({ page }) => {
    // Story 27.1 / FR121: the Create dialog now exposes Upload + Paste/Link
    // (parity with the edit dialog), with photo committed atomically after
    // the create step (FR120 idempotent flow). Verifies the parity-gap
    // closure that was the whole point of Epic 27.
    const itemName = `${testPrefix}-Linked-${Date.now()}`
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')

    // Open create dialog and fill fields.
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByLabel('Name').fill(itemName)

    // Stage a URL via the Paste/Link expandable in the create dialog.
    await page.getByTestId('image-form-inputs-link-prompt').click()
    await page.getByPlaceholder('Paste image or URL').fill('https://picsum.photos/200/200')
    // The expand's Save button stages the URL; the form's outer Save commits it.
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // Staged-state UI: preview + Remove visible, Upload + Paste/Link hidden.
    await expect(page.getByTestId('image-form-inputs-preview')).toBeVisible()

    // Submit the create form (outer "Add Item" submit).
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.waitForTimeout(1500)

    // Item created. Reload and verify it has the linked photo.
    await page.goto('/inventory')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(itemName).first()).toBeVisible()
    await expect(page.getByRole('button', { name: `View photos of ${itemName}` })).toBeVisible()
  })

  test('BOM row shows micro-thumbnail for item with photo', async ({ page }) => {
    await seedInventoryItemImage({
      inventoryItemId: item.id,
      type: 'LINK',
      url: 'https://picsum.photos/100/100',
    })

    const { project } = await seedProject({
      hobbyId: hobby.id,
      name: `${testPrefix} BOM Project`,
      steps: [{ name: 'Step 1', state: 'IN_PROGRESS' }],
    })

    await page.goto(`/hobbies/${hobby.id}/projects/${project.id}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Add item' }).click()
    await page.getByRole('combobox', { name: 'Type to search inventory…' }).fill(testPrefix)

    const option = page.getByRole('option', { name: new RegExp(`${testPrefix} Clay`) })
    await expect(option).toBeVisible({ timeout: 5000 })
    await option.click()

    await expect(page.getByText('1 item')).toBeVisible({ timeout: 5000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    const itemCell = page.locator('td').filter({ hasText: `${testPrefix} Clay` })
    await expect(itemCell).toBeVisible({ timeout: 5000 })
    const microThumb = itemCell.locator('img')
    await expect(microThumb).toBeVisible({ timeout: 5000 })
  })
})
