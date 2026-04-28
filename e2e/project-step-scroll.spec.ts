import { test, expect } from '@playwright/test'
import { seedHobby, seedProject, deleteHobbyCascade } from './helpers/db-seed'

// FR116: when opening a project detail page, the relevant step is auto-
// expanded AND smoothly scrolled into view on mount. Precedence:
//   (1) URL ?step=<id> match,
//   (2) first IN_PROGRESS step,
//   (3) first NOT_STARTED step.
//
// We seed a project with enough steps that the focused one is below the
// viewport at scrollY=0. Playwright's toBeInViewport() auto-waits for the
// smooth-scroll animation to complete.
test.describe.configure({ mode: 'serial' })

test.describe('Project page scroll-to-focused-step (FR116)', () => {
  let hobbyId: string
  let projectId: string
  let stepIds: string[]
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `SCROLL-${browserName}-${Date.now()}`

    const hobby = await seedHobby({
      name: `${testPrefix} Hobby`,
      color: 'hsl(15, 55%, 55%)',
    })
    hobbyId = hobby.id

    // 10 steps total. Step 7 is the only IN_PROGRESS so the default-focus
    // test has a single deterministic target far below the fold.
    const stepDefs = [
      { name: `${testPrefix} Step 1`, state: 'COMPLETED' as const },
      { name: `${testPrefix} Step 2`, state: 'COMPLETED' as const },
      { name: `${testPrefix} Step 3`, state: 'COMPLETED' as const },
      { name: `${testPrefix} Step 4`, state: 'COMPLETED' as const },
      { name: `${testPrefix} Step 5`, state: 'COMPLETED' as const },
      { name: `${testPrefix} Step 6`, state: 'COMPLETED' as const },
      { name: `${testPrefix} Step 7`, state: 'IN_PROGRESS' as const },
      { name: `${testPrefix} Step 8`, state: 'NOT_STARTED' as const },
      { name: `${testPrefix} Step 9`, state: 'NOT_STARTED' as const },
      { name: `${testPrefix} Step 10`, state: 'NOT_STARTED' as const },
    ]
    const { project, steps } = await seedProject({
      hobbyId,
      name: `${testPrefix} Project`,
      steps: stepDefs,
    })
    projectId = project.id
    stepIds = steps.map((step) => step.id)
  })

  test.afterAll(async () => {
    if (hobbyId) await deleteHobbyCascade(hobbyId)
  })

  test('no URL param → first IN_PROGRESS step is scrolled into viewport on mount', async ({
    page,
  }) => {
    await page.goto(`/hobbies/${hobbyId}/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    const inProgressStep = page.locator(`[data-step-id="${stepIds[6]}"]`)
    await expect(inProgressStep).toBeInViewport()

    // First step should NOT be in viewport — proves the page actually scrolled
    // past it (rather than landing at scrollY=0 with everything visible).
    const firstStep = page.locator(`[data-step-id="${stepIds[0]}"]`)
    await expect(firstStep).not.toBeInViewport()
  })

  test('?step=<id> URL param → that step is scrolled into viewport (overrides IN_PROGRESS default)', async ({
    page,
  }) => {
    // Step 10 is NOT_STARTED — different from the default IN_PROGRESS focus,
    // so we know the URL param is what's driving the scroll.
    const targetStepId = stepIds[9]
    await page.goto(`/hobbies/${hobbyId}/projects/${projectId}?step=${targetStepId}`)
    await page.waitForLoadState('networkidle')

    const targetStep = page.locator(`[data-step-id="${targetStepId}"]`)
    await expect(targetStep).toBeInViewport()

    // First step (top of the list) should NOT be in viewport — proves the
    // page actually scrolled. Step 7 isn't a reliable negative because when
    // the focused step is near the bottom, browsers anchor the scroll at
    // page-end and several preceding steps remain visible.
    const firstStep = page.locator(`[data-step-id="${stepIds[0]}"]`)
    await expect(firstStep).not.toBeInViewport()
  })
})
