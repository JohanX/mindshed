import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Public Result Gallery Page', () => {
  let testPrefix: string
  let hobbyId: string
  let gallerySlug: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `RG-${browserName}-${Date.now()}`
  })

  test('setup: create hobby, project, enable result gallery', async ({ page }) => {
    // Create hobby
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(`${testPrefix} Hobby`)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Get hobby ID
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(`${testPrefix} Hobby`) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''

    // Create project with step
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Result Test`)
    await page.getByPlaceholder('Step 1 name').fill('Final Step')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Enable result gallery
    const resultSwitch = page.locator('#result-toggle')
    await resultSwitch.click()
    await page.waitForTimeout(1000)

    // Extract slug
    const links = page.locator('.font-mono')
    const count = await links.count()
    for (let i = 0; i < count; i++) {
      const text = await links.nth(i).textContent()
      if (text?.includes('/result')) {
        const match = text.match(/\/gallery\/([^/]+)\/result/)
        gallerySlug = match?.[1] ?? ''
        break
      }
    }
    expect(gallerySlug).toBeTruthy()
  })

  test('result gallery page loads without authentication', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto(`/gallery/${gallerySlug}/result`)
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain(`/gallery/${gallerySlug}/result`)
  })

  test('displays project name', async ({ page }) => {
    await page.goto(`/gallery/${gallerySlug}/result`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: new RegExp(`${testPrefix} Result Test`) })).toBeVisible()
  })

  test('shows no images message when step has no images', async ({ page }) => {
    await page.goto(`/gallery/${gallerySlug}/result`)
    await page.waitForLoadState('networkidle')
    // No images uploaded, should show fallback
    await expect(page.getByText('No images available')).toBeVisible()
  })

  test('disabled result gallery shows not-found page', async ({ page }) => {
    await page.goto('/gallery/nonexistent-slug-xyz/result')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('404')).toBeVisible({ timeout: 5000 })
  })
})
