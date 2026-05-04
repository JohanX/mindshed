import { test, expect } from '@playwright/test'
import { seedHobby, seedProject, deleteHobbyCascade } from './helpers/db-seed'

// Story 30.5 / FR129 — step time logging E2E.
//
// Scope: hobby with tracking on → step counter visible → increment +/- →
// project total surfaces on the project detail header. We don't toggle the
// hobby off/on in this spec — the underlying behaviour (data layer returns
// null vs. number; UI hides via formatHours) is fully covered by unit
// tests at hours-format.test.ts and project-hours.test.ts.

test.describe.configure({ mode: 'serial' })

test.describe('Step Time Logging (Story 30.5 / FR129)', () => {
  let testPrefix: string
  let trackingHobbyId: string
  let untrackedHobbyId: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `HOURS-${browserName}-${Date.now()}`

    const trackingHobby = await seedHobby({
      name: `${testPrefix} Tracked`,
      color: 'hsl(15, 55%, 55%)',
      hoursTrackingEnabled: true,
    })
    trackingHobbyId = trackingHobby.id

    const untrackedHobby = await seedHobby({
      name: `${testPrefix} Untracked`,
      color: 'hsl(150, 40%, 35%)',
      hoursTrackingEnabled: false,
    })
    untrackedHobbyId = untrackedHobby.id

    await seedProject({
      hobbyId: trackingHobbyId,
      name: `${testPrefix} Tracked Project`,
      steps: [
        { name: 'Plan', state: 'IN_PROGRESS' },
        { name: 'Build', state: 'NOT_STARTED' },
      ],
    })

    await seedProject({
      hobbyId: untrackedHobbyId,
      name: `${testPrefix} Untracked Project`,
      steps: [{ name: 'Sketch', state: 'IN_PROGRESS' }],
    })
  })

  test.afterAll(async () => {
    if (trackingHobbyId) await deleteHobbyCascade(trackingHobbyId)
    if (untrackedHobbyId) await deleteHobbyCascade(untrackedHobbyId)
  })

  test('hobby with tracking on: counter renders, +0.5 persists, project total appears in header', async ({
    page,
  }) => {
    await page.goto(`/hobbies/${trackingHobbyId}`)
    await page.waitForLoadState('networkidle')

    // Click into the tracked project (Plan / Build)
    await page.getByRole('link', { name: new RegExp(`${testPrefix} Tracked Project`) }).click()
    await page.waitForLoadState('networkidle')

    // The first step ("Plan") is auto-expanded as the current step.
    // The counter renders with value "—" (no hours logged yet).
    const firstCounter = page.getByTestId('step-hours-value').first()
    await expect(firstCounter).toBeVisible()
    await expect(firstCounter).toHaveText('—')

    // Click "+" twice → 1h. The optimistic local state updates immediately
    // and the server save is debounced by SAVE_DEBOUNCE_MS (500ms).
    await page.getByRole('button', { name: 'Increase hours by 0.5' }).first().click()
    await page.getByRole('button', { name: 'Increase hours by 0.5' }).first().click()

    // Step shows 1h immediately (optimistic local state, no round-trip).
    await expect(firstCounter).toHaveText('1h')

    // Wait past the debounce window + server round-trip before reload, so
    // the persisted value matches the optimistic state. 1500ms = 500ms
    // debounce + 1000ms slack for action latency on slow CI.
    await page.waitForTimeout(1500)

    // Reload — value persisted; project total visible in header.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('step-hours-value').first()).toHaveText('1h')
    await expect(page.getByTestId('project-total-hours')).toHaveText('1h')
  })

  test('hobby with tracking off: NO counter renders on its project steps', async ({ page }) => {
    await page.goto(`/hobbies/${untrackedHobbyId}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: new RegExp(`${testPrefix} Untracked Project`) }).click()
    await page.waitForLoadState('networkidle')

    // No hours counter, no project total.
    await expect(page.getByTestId('step-hours-value')).toHaveCount(0)
    await expect(page.getByTestId('project-total-hours')).toHaveCount(0)
  })

  test('setStepHours rejects when project is locked (Complete project flow)', async ({ page }) => {
    await page.goto(`/hobbies/${trackingHobbyId}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: new RegExp(`${testPrefix} Tracked Project`) }).click()
    await page.waitForLoadState('networkidle')

    // Lock the project via the meatball menu.
    await page.getByRole('button', { name: 'Project actions' }).click()
    await page.getByRole('menuitem', { name: 'Complete project' }).click()
    await page.waitForTimeout(1000)

    await page.reload()
    await page.waitForLoadState('networkidle')

    // Counter +/- buttons should now be disabled.
    const incrementBtn = page.getByRole('button', { name: 'Increase hours by 0.5' }).first()
    await expect(incrementBtn).toBeDisabled()
  })
})
