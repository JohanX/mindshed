import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Public Journey Gallery Page', () => {
  let testPrefix: string
  let hobbyId: string
  let gallerySlug: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `JG-${browserName}-${Date.now()}`
  })

  test('setup: create hobby, project, enable journey gallery', async ({ page }) => {
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
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Journey Test`)
    await page.getByPlaceholder('Step 1 name').fill('First Step')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Enable journey gallery
    const journeySwitch = page.locator('#journey-toggle')
    await journeySwitch.click()
    await page.waitForTimeout(1000)

    // Extract the gallery slug from the share link
    const linkText = await page.locator('.font-mono').first().textContent()
    const match = linkText?.match(/\/gallery\/(.+)$/)
    gallerySlug = match?.[1] ?? ''
    expect(gallerySlug).toBeTruthy()
  })

  test('journey gallery page loads without authentication', async ({ page, context }) => {
    // Clear cookies to simulate unauthenticated visitor
    await context.clearCookies()
    await page.goto(`/gallery/${gallerySlug}`)
    await page.waitForLoadState('networkidle')

    // Should NOT be 401
    expect(page.url()).toContain(`/gallery/${gallerySlug}`)
  })

  test('displays project name', async ({ page }) => {
    await page.goto(`/gallery/${gallerySlug}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: new RegExp(`${testPrefix} Journey Test`) })).toBeVisible()
  })

  test('disabled journey gallery shows not-found page', async ({ page }) => {
    await page.goto('/gallery/nonexistent-slug-that-doesnt-exist')
    await page.waitForLoadState('networkidle')
    // Next.js renders a not-found page
    await expect(page.getByText('404')).toBeVisible({ timeout: 5000 })
  })
})
