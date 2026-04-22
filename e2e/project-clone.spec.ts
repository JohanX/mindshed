import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Project Cloning', () => {
  let hobbyId: string
  let hobbyName: string

  test.beforeAll(async ({ browser, browserName }) => {
    hobbyName = `PC-${browserName}-${Date.now()}`
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Walnut').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(hobbyName) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const actionButton = page
      .locator('div.relative')
      .filter({ has: page.getByRole('link', { name: new RegExp(hobbyName) }) })
      .getByRole('button', { name: 'Hobby actions' })

    if (await actionButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionButton.click()
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await page.getByRole('button', { name: 'Delete' }).click()
      await page.waitForTimeout(1000)
    }
    await page.close()
  })

  test('clone resets all per-instance state, handles naming collisions, and does not mutate the source', async ({
    page,
  }) => {
    // -------------------- Build a dirty source --------------------
    // Source: "Knife" with 3 steps, where the source carries state that MUST NOT
    // leak into the clone: IN_PROGRESS step, a note, an image (via URL link), a
    // blocker, and an enabled Journey Gallery.
    await page.goto(`/hobbies/${hobbyId}`)
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Knife')

    await page.getByPlaceholder('Step 1 name').fill('Grind bevels')
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step 2 name').fill('Heat treat')
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step 3 name').fill('Handle')

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(/\/hobbies\/.*\/projects\//, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Knife' })).toBeVisible()
    const sourceUrl = page.url()

    // Advance first step to IN_PROGRESS
    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /In Progress/ }).click()
    await expect(page.getByText('In Progress').first()).toBeVisible({ timeout: 5000 })

    // Add a note to the current step
    await page.getByText('Add a note...').first().click()
    await page.getByPlaceholder('Write a note...').fill('Do NOT carry over')
    await page.getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByText('Do NOT carry over')).toBeVisible({ timeout: 5000 })

    // Add an image via URL link (cheaper than upload — exercises the same
    // StepImage row that the clone must skip).
    await page.getByRole('button', { name: 'Paste Image / Link' }).first().click()
    await page.getByPlaceholder('Paste image or URL').fill('https://example.com/source-only.png')
    await page.getByRole('button', { name: 'Save' }).first().click()
    await page.waitForTimeout(1000)

    // Add a blocker on the current step
    await page.getByText('Add a blocker...').first().click()
    await page.getByPlaceholder("Describe what's blocking this step...").fill('Waiting on steel')
    await page.getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByText('Waiting on steel')).toBeVisible({ timeout: 5000 })

    // Enable the Journey Gallery on the source — this allocates a gallery slug
    // that the clone MUST NOT inherit (gallerySlug is @unique).
    await page.getByRole('switch', { name: 'Journey Gallery' }).click()
    await expect(page.getByText(/\/gallery\//).first()).toBeVisible({ timeout: 5000 })

    // -------------------- Clone #1 --------------------
    await page.getByRole('button', { name: 'Project actions' }).click()
    await page.getByRole('menuitem', { name: 'Clone' }).click()
    // Success toast from AC #10 — has to appear on the destination page.
    await expect(page.getByText('Project cloned')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Knife (copy)' })).toBeVisible({
      timeout: 10000,
    })
    await expect(page).toHaveURL(/\/hobbies\/.*\/projects\//)
    await page.waitForLoadState('networkidle')
    const cloneUrl = page.url()
    expect(cloneUrl).not.toBe(sourceUrl)

    // Step structure preserved, state reset
    await expect(page.getByText('Grind bevels')).toBeVisible()
    await expect(page.getByText('Heat treat')).toBeVisible()
    await expect(page.getByText('Handle')).toBeVisible()
    // No residual non-NOT_STARTED state on any cloned step. Scope to the step
    // list to avoid matching "In Progress" inside a collapsed <select> listbox.
    const stepList = page.locator('main')
    await expect(stepList.getByText('In Progress', { exact: true })).toHaveCount(0)
    await expect(stepList.getByText('Blocked', { exact: true })).toHaveCount(0)
    await expect(stepList.getByText('Completed', { exact: true })).toHaveCount(0)

    // Anti-leak assertions: none of the source's per-instance state should appear
    await expect(page.getByText('Do NOT carry over')).toHaveCount(0)
    await expect(page.getByText('Waiting on steel')).toHaveCount(0)
    // No step-image thumbnails of any kind — the Photos section on every step
    // renders the "Add photos..." empty-state instead. `View <filename>` is
    // the accessible label every thumbnail gets in `image-gallery.tsx`.
    await expect(page.getByRole('button', { name: /^View / })).toHaveCount(0)
    await expect(page.getByText('Add photos to document your progress.')).not.toHaveCount(0)

    // Gallery toggles both OFF, no share link visible
    await expect(page.getByRole('switch', { name: 'Journey Gallery' })).not.toBeChecked()
    await expect(page.getByRole('switch', { name: 'Result Gallery' })).not.toBeChecked()
    await expect(page.getByText(/\/gallery\//)).toHaveCount(0)

    // -------------------- Source is NOT mutated by the clone --------------------
    // (Note: step 1 is now BLOCKED, not IN_PROGRESS — adding a blocker to an
    // in-progress step auto-transitions its state to BLOCKED. That's the app's
    // existing behavior; what matters for this story is that the SOURCE still
    // has its note, blocker, and enabled gallery after the clone.)
    await page.goto(sourceUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Knife', exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('Do NOT carry over')).toBeVisible()
    await expect(page.getByText('Waiting on steel')).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Journey Gallery' })).toBeChecked()

    // -------------------- Clone #2: naming collision advances counter --------------------
    await page.getByRole('button', { name: 'Project actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Clone' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('menuitem', { name: 'Clone' }).click()
    await expect(page.getByRole('heading', { name: 'Knife (copy 2)' })).toBeVisible({
      timeout: 10000,
    })

    // -------------------- Clone #3: cloning a clone uses source's current name --------------------
    // From "Knife (copy 2)", cloning once must produce "Knife (copy 2) (copy)" —
    // proving the base name for the suffix is whatever is being cloned, not the
    // original root name.
    await page.getByRole('button', { name: 'Project actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Clone' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('menuitem', { name: 'Clone' }).click()
    await expect(page.getByRole('heading', { name: 'Knife (copy 2) (copy)' })).toBeVisible({
      timeout: 10000,
    })
  })
})
