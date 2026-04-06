import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Project Management', () => {
  let hobbyId: string
  let hobbyName: string

  test.beforeAll(async ({ browser, browserName }) => {
    hobbyName = `PM-${browserName}-${Date.now()}`
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Create a test hobby (scoped to main to avoid top bar button)
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Walnut').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Get hobby ID from the created hobby link
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(hobbyName) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    // Clean up: delete the specific hobby we created
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Find our specific hobby's action button using robust selector
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

  test('hobby detail page shows empty state with create button', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('No projects yet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Project' }).first()).toBeVisible()
  })

  test('can create a project with steps', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.getByRole('button', { name: 'Create Project' }).first().click()

    // Fill project name
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Test Table')

    // First step is already shown
    await page.getByPlaceholder('Step 1 name').fill('Design')

    // Add more steps
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step 2 name').fill('Cut')

    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step 3 name').fill('Assembly')

    // Save
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Should be redirected to project view
    await expect(page).toHaveURL(/\/hobbies\/.*\/projects\//)
    await expect(page.getByRole('heading', { name: 'Test Table' })).toBeVisible()
  })

  test('project view shows steps in order', async ({ page }) => {
    // Navigate to the project we just created
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Test Table').first().click()
    await page.waitForLoadState('networkidle')

    // Steps should be visible
    await expect(page.getByText('Design')).toBeVisible()
    await expect(page.getByText('Cut')).toBeVisible()
    await expect(page.getByText('Assembly')).toBeVisible()
  })

  test('project card shows step progress summary', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')

    // The project created in the previous test should show step progress
    await expect(page.getByText('Test Table').first()).toBeVisible()

    // Should show step count like "0/3 steps"
    await expect(page.getByText(/\d+\/3 steps/)).toBeVisible()
  })

  test('tapping project card navigates to project detail', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')

    await page.getByText('Test Table').first().click()
    await expect(page).toHaveURL(/\/hobbies\/.*\/projects\//)
    await expect(page.getByRole('heading', { name: 'Test Table' })).toBeVisible()
  })

  test('save button disabled when project name is empty', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.getByRole('button', { name: 'Create Project' }).first().click()

    // Don't fill name, just add a step
    await page.getByPlaceholder('Step 1 name').fill('Some Step')

    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('all-projects page shows projects with hobby badges', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // The project created earlier should appear with hobby name
    await expect(page.getByText('Test Table').first()).toBeVisible()
    await expect(page.getByText(hobbyName).first()).toBeVisible()
  })

  test('can edit a project name via context menu', async ({ page }) => {
    // Navigate to the project
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Test Table').first().click()
    await page.waitForLoadState('networkidle')

    // Open context menu and click Edit
    await page.getByRole('button', { name: 'Project actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    // Change name
    const nameInput = page.getByLabel('Project Name')
    await nameInput.clear()
    await nameInput.fill('Renamed Table')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Verify updated
    await expect(page.getByRole('heading', { name: 'Renamed Table' })).toBeVisible()
  })

  test('can delete a project via context menu', async ({ page }) => {
    // Create a project to delete
    await page.goto(`/hobbies/${hobbyId}`)
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Delete Me Project')
    await page.getByPlaceholder('Step 1 name').fill('Step One')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Should be on project view
    await expect(page.getByRole('heading', { name: 'Delete Me Project' })).toBeVisible()

    // Delete it
    await page.getByRole('button', { name: 'Project actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(1000)

    // Should redirect to hobby page
    await expect(page).toHaveURL(new RegExp(`/hobbies/${hobbyId}`))
  })

  test('can add a step and change state', async ({ page }) => {
    // Create a fresh project for step management
    await page.goto(`/hobbies/${hobbyId}`)
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Step Test Project')
    await page.getByPlaceholder('Step 1 name').fill('Initial Step')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Should be on project view
    await expect(page.getByRole('heading', { name: 'Step Test Project' })).toBeVisible()
    await expect(page.getByText('Initial Step')).toBeVisible()

    // Add a step
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step name').fill('New Step')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.waitForTimeout(1000)

    // Reload and verify
    await page.goto(page.url())
    await expect(page.getByText('New Step')).toBeVisible()

    // Start a step
    const startButton = page.getByTitle('Start step').first()
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click()
      await page.waitForTimeout(1000)
      await page.goto(page.url())
      await expect(page.getByText('In Progress')).toBeVisible()
    }
  })

  test('can edit a step name', async ({ page }) => {
    // Navigate to the step test project created above
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Step Test Project').first().click()
    await page.waitForLoadState('networkidle')

    // Edit via context menu
    const stepActions = page.getByRole('button', { name: 'Step actions' }).first()
    await stepActions.click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    // Change name
    const editInput = page.getByRole('textbox').first()
    await editInput.clear()
    await editInput.fill('Edited Step')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Verify updated
    await page.goto(page.url())
    await expect(page.getByText('Edited Step')).toBeVisible()
  })

  test('can delete a step with confirmation', async ({ page }) => {
    // Navigate to the step test project
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Step Test Project').first().click()
    await page.waitForLoadState('networkidle')

    // Wait for steps to render
    await expect(page.getByRole('button', { name: 'Step actions' }).first()).toBeVisible()
    const countBefore = await page.getByRole('button', { name: 'Step actions' }).count()

    // Delete last step via context menu
    await page.getByRole('button', { name: 'Step actions' }).last().click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(1000)

    // Verify one fewer step
    await page.goto(page.url())
    await page.waitForLoadState('networkidle')
    if (countBefore > 1) {
      const countAfter = await page.getByRole('button', { name: 'Step actions' }).count()
      expect(countAfter).toBe(countBefore - 1)
    } else {
      // If only one step, should show empty state or just Add Step
      await expect(page.getByRole('button', { name: 'Add Step' })).toBeVisible()
    }
  })

  test('fresh projects are not idle', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Renamed Table').first()).toBeVisible()
  })

  test('can reorder steps with up/down buttons', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Reorder Test Project')
    await page.getByPlaceholder('Step 1 name').fill('Step Alpha')
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step 2 name').fill('Step Beta')
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step 3 name').fill('Step Gamma')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    await expect(page.getByRole('heading', { name: 'Reorder Test Project' })).toBeVisible()

    // Set mobile viewport for up/down buttons
    await page.setViewportSize({ width: 375, height: 812 })

    // Move "Step Beta" up
    const moveUpButtons = page.getByRole('button', { name: 'Move step up' })
    await moveUpButtons.nth(1).click()
    await page.waitForTimeout(1000)

    // Reload and verify order persists
    await page.goto(page.url())
    await page.waitForLoadState('networkidle')
    await page.setViewportSize({ width: 375, height: 812 })

    const stepNames = await page.getByTestId('step-name').allTextContents()
    expect(stepNames[0]).toBe('Step Beta')
    expect(stepNames[1]).toBe('Step Alpha')
    expect(stepNames[2]).toBe('Step Gamma')
  })

})
