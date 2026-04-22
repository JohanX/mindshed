import { test, expect } from '@playwright/test'
import { seedHobby, seedProject, deleteHobbyCascade } from './helpers/db-seed'

// Historically this file flaked on CI: 4 waitForTimeout + 4 networkidle calls,
// UI-based seeding, no serial mode, and .first() selectors that matched stale
// data from other specs. Story 19.1 rewrites it to:
//   - serial mode (explicit ordering, state dependency allowed)
//   - DB seed via Prisma (instant, deterministic)
//   - Playwright auto-waits (waitForURL, toBeVisible, etc.) — zero waitForTimeout
//   - Scoped selectors (by testPrefix) to avoid cross-spec leakage
test.describe.configure({ mode: 'serial' })

test.describe('Dashboard', () => {
  let testPrefix: string
  let hobbyId: string
  let projectId: string
  const projectName = (): string => `${testPrefix} Dashboard Project`

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `DASH-${browserName}-${Date.now()}`

    const hobby = await seedHobby({
      name: `${testPrefix} Hobby`,
      color: 'hsl(15, 55%, 55%)', // Terracotta
    })
    hobbyId = hobby.id

    const { project } = await seedProject({
      hobbyId,
      name: projectName(),
      steps: [{ name: 'First Step', state: 'IN_PROGRESS' }],
    })
    projectId = project.id
  })

  test.afterAll(async () => {
    if (hobbyId) await deleteHobbyCascade(hobbyId)
  })

  test('dashboard renders the page heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  })

  test('shows seeded project in the Continue section', async ({ page }) => {
    await page.goto('/')

    // Section header — proves the Continue block rendered at all.
    await expect(page.getByText('Continue', { exact: false }).first()).toBeVisible()

    // The seeded project card. testPrefix scopes us to this spec's data, so
    // other specs' leaked artifacts (if any) are filtered out.
    await expect(page.getByText(projectName())).toBeVisible()
  })

  test('shows section headers for blockers and idle projects', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Active Blockers').first()).toBeVisible()
    await expect(page.getByText('Idle Projects').first()).toBeVisible()
  })

  test('clicking the continue card navigates to the project detail page', async ({ page }) => {
    await page.goto('/')
    // Click the project's Continue link — .first() is safe here because we
    // scoped by the unique testPrefix project name.
    await page.getByText(projectName()).first().click()
    // Project-detail URL is /hobbies/{hobbyId}/projects/{projectId} (possibly
    // with a trailing slash from Next.js). Avoid `$` anchor — UUIDs already
    // make the match unambiguous.
    await page.waitForURL(new RegExp(`/hobbies/${hobbyId}/projects/${projectId}`))
    // Confirm arrival with the project-page breadcrumb/heading.
    await expect(page.getByRole('heading', { name: projectName() })).toBeVisible()
  })
})
