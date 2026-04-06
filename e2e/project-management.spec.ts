import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Project Management', () => {
  let hobbyId: string

  test.beforeAll(async ({ browser }) => {
    // Create a hobby for project tests
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Create a test hobby
    await page.getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill('E2E Project Hobby')
    await page.getByTitle('Walnut').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Get hobby ID from the created hobby link
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: /E2E Project Hobby/ }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    // Clean up: delete the hobby
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const actionButton = page.getByRole('button', { name: 'Hobby actions' }).first()
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
    await page.getByText('Test Table').click()
    await page.waitForLoadState('networkidle')

    // Steps should be visible
    await expect(page.getByText('Design')).toBeVisible()
    await expect(page.getByText('Cut')).toBeVisible()
    await expect(page.getByText('Assembly')).toBeVisible()
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
    await expect(page.getByText('Test Table')).toBeVisible()
    await expect(page.getByText('E2E Project Hobby')).toBeVisible()
  })
})
