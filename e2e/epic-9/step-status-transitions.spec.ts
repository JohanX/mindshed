import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Bidirectional Step Status Transitions', () => {
  let testPrefix: string
  let hobbyId: string
  let projectUrl: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `ST-${browserName}-${Date.now()}`
  })

  test('setup: create hobby and project with steps', async ({ page }) => {
    // Create a hobby
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(`${testPrefix} Hobby`)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Get hobby ID
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(`${testPrefix} Hobby`) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''

    // Create a project with a step
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Project`)
    await page.getByPlaceholder('Step 1 name').fill('Step Alpha')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Store project URL
    projectUrl = page.url()
  })

  test('status dropdown is visible on step card', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Find the status select trigger
    const statusSelect = page.getByLabel('Step status').first()
    await expect(statusSelect).toBeVisible()
  })

  test('change step from NOT_STARTED to IN_PROGRESS via dropdown', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Click the status dropdown
    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)

    // Select IN_PROGRESS
    await page.getByRole('option', { name: /In Progress/ }).click()
    await page.waitForTimeout(1000)

    // Verify the badge updated
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const badge = page.locator('[data-testid^="step-card-"]').first().getByLabel('Step status')
    await expect(badge).toContainText('In Progress')
  })

  test('change step from IN_PROGRESS to BLOCKED via dropdown', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)

    await page.getByRole('option', { name: /Blocked/ }).click()
    await page.waitForTimeout(1000)

    // Verify it shows Blocked
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const badge = page.locator('[data-testid^="step-card-"]').first().getByLabel('Step status')
    await expect(badge).toContainText('Blocked')
  })

  test('change step from BLOCKED restores to IN_PROGRESS (previousState)', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Currently BLOCKED, click dropdown
    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)

    // Select NOT_STARTED — but server should restore to IN_PROGRESS (previousState)
    await page.getByRole('option', { name: /Not Started/ }).click()
    await page.waitForTimeout(1000)

    // Verify it restored to IN_PROGRESS (the previousState)
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const badge = page.locator('[data-testid^="step-card-"]').first().getByLabel('Step status')
    await expect(badge).toContainText('In Progress')
  })

  test('change step from IN_PROGRESS to COMPLETED', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)

    await page.getByRole('option', { name: /Completed/ }).click()
    await page.waitForTimeout(1000)

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const badge = page.locator('[data-testid^="step-card-"]').first().getByLabel('Step status')
    await expect(badge).toContainText('Completed')
  })

  test('revert step from COMPLETED to NOT_STARTED', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)

    await page.getByRole('option', { name: /Not Started/ }).click()
    await page.waitForTimeout(1000)

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const badge = page.locator('[data-testid^="step-card-"]').first().getByLabel('Step status')
    await expect(badge).toContainText('Not Started')
  })
})
