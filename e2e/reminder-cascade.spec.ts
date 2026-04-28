import { test, expect } from '@playwright/test'
import {
  seedHobby,
  seedProject,
  seedReminder,
  countReminderById,
  deleteHobbyCascade,
} from './helpers/db-seed'

// Story 25.2 — verifies FR103 cascade-delete of Reminder rows when their
// polymorphic targetId parent (Step / Project / Hobby) is deleted via the
// production server actions. The action-layer cascade was shipped in
// Epic 22 / Story 22.1 (actions/{step,project,hobby}.ts call
// tx.reminder.deleteMany inside the delete transaction); this spec adds the
// missing E2E coverage so future regressions get caught by CI rather than
// by users seeing ghost reminders on the dashboard.
test.describe.configure({ mode: 'serial' })

test.describe('Reminder cascade on parent deletion (Story 25.2)', () => {
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `RC-${browserName}-${Date.now()}`
  })

  test('Step delete cascades reminders attached to that step', async ({ page }) => {
    test.setTimeout(60_000)

    // Seed: Hobby + Project + 2 Steps. Reminder on Step #1 only.
    const hobby = await seedHobby({ name: `${testPrefix} Step Hobby`, color: 'hsl(15, 55%, 55%)' })
    const { project, steps } = await seedProject({
      hobbyId: hobby.id,
      name: `${testPrefix} Step Project`,
      steps: [
        { name: 'Step One', state: 'IN_PROGRESS' },
        { name: 'Step Two', state: 'NOT_STARTED' },
      ],
    })
    const reminder = await seedReminder({ targetType: 'STEP', targetId: steps[0].id })

    // Sanity: reminder exists in DB.
    expect(await countReminderById(reminder.id)).toBe(1)

    // UI delete of Step One via the project page.
    await page.goto(`/hobbies/${hobby.id}/projects/${project.id}`)
    await page.waitForLoadState('networkidle')

    // Step One has its actions menu — open it and click Delete.
    const stepRow = page.locator('[data-step-id]').first()
    await stepRow.getByRole('button', { name: /Step actions/i }).click()
    await page.getByRole('menuitem', { name: /Delete/i }).click()
    // Confirm dialog
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    // Wait for the step to be removed from the DOM
    await expect(page.locator(`[data-step-id="${steps[0].id}"]`)).toHaveCount(0, {
      timeout: 5000,
    })

    // Cascade assertion: reminder row is gone.
    expect(await countReminderById(reminder.id)).toBe(0)

    // Cleanup
    await deleteHobbyCascade(hobby.id)
  })

  test('Project delete cascades reminders on the project AND its child steps', async ({ page }) => {
    test.setTimeout(60_000)

    const hobby = await seedHobby({ name: `${testPrefix} Proj Hobby`, color: 'hsl(15, 55%, 55%)' })
    const { project, steps } = await seedProject({
      hobbyId: hobby.id,
      name: `${testPrefix} Proj Project`,
      steps: [
        { name: 'Alpha', state: 'IN_PROGRESS' },
        { name: 'Beta', state: 'NOT_STARTED' },
      ],
    })

    // Three reminders: one on the project itself, two on its children.
    const projReminder = await seedReminder({ targetType: 'PROJECT', targetId: project.id })
    const stepAReminder = await seedReminder({ targetType: 'STEP', targetId: steps[0].id })
    const stepBReminder = await seedReminder({ targetType: 'STEP', targetId: steps[1].id })

    // Sanity: all 3 exist.
    expect(await countReminderById(projReminder.id)).toBe(1)
    expect(await countReminderById(stepAReminder.id)).toBe(1)
    expect(await countReminderById(stepBReminder.id)).toBe(1)

    // UI delete the project.
    await page.goto(`/hobbies/${hobby.id}/projects/${project.id}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Project actions' }).click()
    await page.getByRole('menuitem', { name: /Delete/i }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    // Wait for navigation away from the project page.
    await page.waitForURL(/\/hobbies\/[^/]+\/?$|\/projects\/?$|\/$/, { timeout: 10000 })

    // Cascade assertion: all 3 reminders are gone.
    expect(await countReminderById(projReminder.id)).toBe(0)
    expect(await countReminderById(stepAReminder.id)).toBe(0)
    expect(await countReminderById(stepBReminder.id)).toBe(0)

    // Cleanup
    await deleteHobbyCascade(hobby.id)
  })

  test('Hobby delete cascades reminders on hobby descendants (project + steps)', async ({
    page,
  }) => {
    test.setTimeout(60_000)

    const hobby = await seedHobby({ name: `${testPrefix} Hobby Hobby`, color: 'hsl(15, 55%, 55%)' })
    const { project, steps } = await seedProject({
      hobbyId: hobby.id,
      name: `${testPrefix} Hobby Project`,
      steps: [{ name: 'Only Step', state: 'IN_PROGRESS' }],
    })
    const projReminder = await seedReminder({ targetType: 'PROJECT', targetId: project.id })
    const stepReminder = await seedReminder({ targetType: 'STEP', targetId: steps[0].id })

    expect(await countReminderById(projReminder.id)).toBe(1)
    expect(await countReminderById(stepReminder.id)).toBe(1)

    // UI delete the hobby from /settings.
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyRow = page
      .locator('div.relative')
      .filter({ has: page.getByRole('link', { name: new RegExp(hobby.name) }) })
    await hobbyRow.getByRole('button', { name: 'Hobby actions' }).click()
    await page.getByRole('menuitem', { name: /Delete/i }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    // Wait for the success toast — confirms the server action committed.
    await expect(page.getByText(/Hobby deleted/i)).toBeVisible({ timeout: 5000 })
    // Wait for the hobby row to disappear from the settings list.
    await expect(page.getByRole('link', { name: new RegExp(hobby.name) })).toHaveCount(0, {
      timeout: 5000,
    })

    // Cascade assertion: descendant reminders gone.
    expect(await countReminderById(projReminder.id)).toBe(0)
    expect(await countReminderById(stepReminder.id)).toBe(0)
  })
})
