import { test, expect } from '@playwright/test'
import { seedHobby, seedProject, deleteHobbyCascade } from '../helpers/db-seed'

test.describe.configure({ mode: 'serial' })

test.describe('Bidirectional Step Status Transitions', () => {
  let testPrefix: string
  let hobbyId: string
  let projectUrl: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `ST-${browserName}-${Date.now()}`

    const hobby = await seedHobby({
      name: `${testPrefix} Hobby`,
      color: 'hsl(15, 55%, 55%)' /* Terracotta */,
    })
    hobbyId = hobby.id

    const { project } = await seedProject({
      hobbyId,
      name: `${testPrefix} Project`,
      steps: [{ name: 'Step Alpha', state: 'NOT_STARTED' }],
    })
    projectUrl = `/hobbies/${hobbyId}/projects/${project.id}`
  })

  test.afterAll(async () => {
    if (hobbyId) await deleteHobbyCascade(hobbyId)
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

  test('revert step from IN_PROGRESS to NOT_STARTED', async ({ page }) => {
    // Step is currently IN_PROGRESS (from the previous test)
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

  test('change step to COMPLETED auto-completes single-step project', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)

    await page.getByRole('option', { name: /Completed/ }).click()
    await page.waitForTimeout(1000)

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    // The dropdown should be disabled since project is now auto-completed
    const badge = page.getByLabel('Step status').first()
    await expect(badge).toBeDisabled()
  })
})
