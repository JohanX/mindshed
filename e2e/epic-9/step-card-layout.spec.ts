import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Step Card Layout', () => {
  let testPrefix: string
  let hobbyId: string
  let projectUrl: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `SL-${browserName}-${Date.now()}`
  })

  test('setup: create hobby and project with steps', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(`${testPrefix} Hobby`)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(`${testPrefix} Hobby`) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''

    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Layout Project`)
    await page.getByPlaceholder('Step 1 name').fill('Step With Content')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)
    projectUrl = page.url()
  })

  test('expanded step has separator elements between sections', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // The current step should be expanded by default
    const stepCard = page.locator('[data-testid^="step-card-"]').first()
    await expect(stepCard).toBeVisible()

    // Check for separator elements inside the step card
    const separators = stepCard.locator('[data-slot="separator"]')
    const count = await separators.count()
    // Should have at least 1 separator (between Photos and Notes)
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('collapsed step without images does not show thumbnail strip', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // The step has no images, so no thumbnail strip should be visible
    const thumbnailStrip = page.locator('[aria-label^="Step has"]')
    await expect(thumbnailStrip).not.toBeVisible()
  })

  test('expand and collapse animation works', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const stepCard = page.locator('[data-testid^="step-card-"]').first()
    const expandBtn = stepCard.locator('button[aria-expanded]').first()

    // Should start expanded (current variant)
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'true')

    // Collapse
    await expandBtn.click()
    await page.waitForTimeout(300)
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'false')

    // Expand again
    await expandBtn.click()
    await page.waitForTimeout(300)
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'true')

    // Photos heading should be visible when expanded
    await expect(stepCard.getByRole('heading', { name: 'Photos' })).toBeVisible()
  })
})
