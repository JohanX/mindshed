import { test, expect } from '@playwright/test'
import { seedHobby, seedProject, deleteHobbyCascade } from '../helpers/db-seed'

test.describe.configure({ mode: 'serial' })

test.describe('Auto-Derived Project Status', () => {
  let testPrefix: string
  let hobbyId: string
  let projectUrl: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `PS-${browserName}-${Date.now()}`

    const hobby = await seedHobby({
      name: `${testPrefix} Hobby`,
      color: 'hsl(15, 55%, 55%)' /* Terracotta */,
    })
    hobbyId = hobby.id

    const { project } = await seedProject({
      hobbyId,
      name: `${testPrefix} Status Project`,
      steps: [
        { name: 'Step One', state: 'NOT_STARTED' },
        { name: 'Step Two', state: 'NOT_STARTED' },
      ],
    })
    projectUrl = `/hobbies/${hobbyId}/projects/${project.id}`
  })

  test.afterAll(async () => {
    if (hobbyId) await deleteHobbyCascade(hobbyId)
  })

  test('project with all NOT_STARTED steps shows "Not Started" badge', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // The project status badge is next to the project actions button
    await expect(page.getByText('Not Started').first()).toBeVisible()
  })

  test('start a step -> project shows "In Progress"', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Change first step to IN_PROGRESS
    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /In Progress/ }).click()
    await page.waitForTimeout(1000)

    // Reload and check project status badge
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('In Progress').first()).toBeVisible()
  })

  test('block a step -> project shows "Blocked"', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /Blocked/ }).click()
    await page.waitForTimeout(1000)

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Blocked').first()).toBeVisible()
  })

  test('unblock step -> project shows "In Progress" again', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /In Progress/ }).click()
    await page.waitForTimeout(1000)

    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('In Progress').first()).toBeVisible()
  })

  test('complete all steps -> project shows "Completed"', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Complete first step
    const firstSelect = page.getByLabel('Step status').first()
    await firstSelect.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /Completed/ }).click()
    await page.waitForTimeout(1000)

    // Complete second step
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const secondSelect = page.getByLabel('Step status').nth(1)
    await secondSelect.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /Completed/ }).click()
    await page.waitForTimeout(1000)

    // Reload and check
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Completed').first()).toBeVisible()
  })

  test('project detail page does NOT show a "Mark Complete" button', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /Mark Complete/i })).not.toBeVisible()
  })
})
