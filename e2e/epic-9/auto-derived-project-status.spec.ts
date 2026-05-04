import { test, expect } from '@playwright/test'
import { seedHobby, seedProject, deleteHobbyCascade } from '../helpers/db-seed'

test.describe.configure({ mode: 'serial' })

// Story 30.3 / FR127 redirected this spec from "auto-derived completion"
// to "derived status BADGE + explicit user-driven LOCK STATE."
//
// After Story 30.3:
//   - `deriveProjectStatus(steps)` is unchanged — the badge still shows
//     `Completed | In Progress | Blocked | Not Started` based on step
//     states alone.
//   - `project.isCompleted` is a separate, user-driven flag — set via the
//     confirmation dialog after the last step completes, OR via the
//     "Complete project" item in the project meatball menu. Lock state
//     (Add Step button, mutation gating) reads this flag, NOT the badge.
test.describe('Auto-Derived Project Status (badge) + Explicit Lock State', () => {
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

  test('complete all steps -> badge shows "Completed", confirmation dialog appears, "Not yet" leaves project unlocked', async ({
    page,
  }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Complete first step (no dialog yet — second step still incomplete)
    const firstSelect = page.getByLabel('Step status').first()
    await firstSelect.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /Completed/ }).click()
    await page.waitForTimeout(1000)

    // Reload to ensure server-revalidated state
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Complete second step → this transition completes ALL steps → dialog
    const secondSelect = page.getByLabel('Step status').nth(1)
    await secondSelect.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /Completed/ }).click()

    // Story 30.3 / FR127: confirmation dialog appears
    await expect(page.getByRole('alertdialog', { name: 'Mark project complete?' })).toBeVisible({
      timeout: 5000,
    })

    // Pick "Not yet" — step stays COMPLETED but project stays unlocked
    await page.getByRole('button', { name: 'Not yet' }).click()
    await page.waitForTimeout(500)

    // Reload and verify: badge shows "Completed" (derived), project is
    // STILL editable (Add Step visible — would not be visible if locked).
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Completed').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Step' })).toBeVisible()
  })

  test('project meatball shows "Complete project" while unlocked, "Unlock project" while locked', async ({
    page,
  }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Project should still be unlocked from the previous test ("Not yet")
    await page.getByRole('button', { name: 'Project actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Complete project' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Complete project' }).click()
    await page.waitForTimeout(1000)

    // Reload — project is now locked, Add Step disappears, meatball flips
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Add Step' })).not.toBeVisible()

    await page.getByRole('button', { name: 'Project actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Unlock project' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Unlock project' }).click()
    await page.waitForTimeout(1000)

    // Reload — project unlocked again, Add Step reappears, meatball flips back
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Add Step' })).toBeVisible()

    await page.getByRole('button', { name: 'Project actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Complete project' })).toBeVisible()
  })
})
