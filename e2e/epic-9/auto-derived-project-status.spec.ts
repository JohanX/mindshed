import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Auto-Derived Project Status', () => {
  let testPrefix: string
  let hobbyId: string
  let projectUrl: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `PS-${browserName}-${Date.now()}`
  })

  test('setup: create hobby and project with two steps', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(`${testPrefix} Hobby`)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(`${testPrefix} Hobby`) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''

    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Status Project`)
    await page.getByPlaceholder('Step 1 name').fill('Step One')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    projectUrl = page.url()

    // Add a second step
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step name').fill('Step Two')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.waitForTimeout(1000)
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
