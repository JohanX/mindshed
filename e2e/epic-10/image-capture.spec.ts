import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Camera Capture', () => {
  let testPrefix: string
  let hobbyId: string
  let projectUrl: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `CC-${browserName}-${Date.now()}`
  })

  test('setup: create hobby and project with a step', async ({ page }) => {
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
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Capture Project`)
    await page.getByPlaceholder('Step 1 name').fill('Photo Step')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)
    projectUrl = page.url()
  })

  test('"Take Photo" button is visible adjacent to "Upload Photo"', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Upload Photo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Take Photo' })).toBeVisible()
  })

  test('camera input has capture="environment" attribute', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const captureInput = page.locator('input[capture="environment"]')
    await expect(captureInput).toBeAttached()
  })
})
