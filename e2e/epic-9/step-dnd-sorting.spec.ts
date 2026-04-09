import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Step Drag-and-Drop Sorting', () => {
  let testPrefix: string
  let hobbyId: string
  let projectUrl: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `DD-${browserName}-${Date.now()}`
  })

  test('setup: create hobby and project with three steps', async ({ page }) => {
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
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} DnD Project`)
    await page.getByPlaceholder('Step 1 name').fill('Alpha')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)
    projectUrl = page.url()

    // Add second step
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step name').fill('Beta')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.waitForTimeout(1000)

    // Add third step
    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step name').fill('Gamma')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.waitForTimeout(1000)
  })

  test('ArrowUp/ArrowDown buttons are NOT present on step cards', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Move step up' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Move step down' })).not.toBeVisible()
  })

  test('drag handle is visible on step cards', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const handles = page.getByLabel('Drag to reorder')
    const count = await handles.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('Add Step form still works after refactor', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Add Step' }).click()
    await page.getByPlaceholder('Step name').fill('Delta')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.waitForTimeout(1000)

    // Reload and verify
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const stepCards = page.locator('[data-testid^="step-card-"]')
    const count = await stepCards.count()
    expect(count).toBe(4)
  })
})
