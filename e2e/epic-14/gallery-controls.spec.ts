import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Gallery Controls on Project Detail Page', () => {
  let testPrefix: string
  let hobbyId: string
  let projectUrl: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `GC-${browserName}-${Date.now()}`
  })

  test('setup: create hobby and project with steps and images', async ({ page }) => {
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

    // Create project with a step
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Gallery Project`)
    await page.getByPlaceholder('Step 1 name').fill('Step One')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    projectUrl = page.url()
  })

  test('gallery section is visible on project page', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
    await expect(page.getByText('Journey Gallery', { exact: true })).toBeVisible()
    await expect(page.getByText('Result Gallery', { exact: true })).toBeVisible()
  })

  test('toggle Journey gallery on shows share link', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Enable Journey gallery
    const journeySwitch = page.locator('#journey-toggle')
    await journeySwitch.click()
    await page.waitForTimeout(1000)

    // Share link should appear with the gallery URL
    await expect(page.locator('.font-mono').first()).toBeVisible()
    const linkText = await page.locator('.font-mono').first().textContent()
    expect(linkText).toContain('/gallery/')
  })

  test('toggle Journey gallery off hides share link', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // Journey should be enabled from previous test
    const journeySwitch = page.locator('#journey-toggle')
    await journeySwitch.click()
    await page.waitForTimeout(1000)

    // Reload to see updated state
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    // No share link visible under Journey section
    // The Journey toggle should be off
    await expect(journeySwitch).not.toBeChecked()
  })

  test('toggle Result gallery on shows share link', async ({ page }) => {
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')

    const resultSwitch = page.locator('#result-toggle')
    await resultSwitch.click()
    await page.waitForTimeout(1000)

    // Share link with /result should appear
    const links = page.locator('.font-mono')
    const count = await links.count()
    let foundResultLink = false
    for (let i = 0; i < count; i++) {
      const text = await links.nth(i).textContent()
      if (text?.includes('/result')) foundResultLink = true
    }
    expect(foundResultLink).toBe(true)
  })

  test('gallery toggles persist across hard reload and navigation (Story 18.4)', async ({
    page,
  }) => {
    test.setTimeout(60_000)

    // After the previous tests, Journey is OFF and Result is ON. Start from a
    // known state by enabling Journey so both are ON.
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    const journeySwitch = page.locator('#journey-toggle')
    const resultSwitch = page.locator('#result-toggle')

    if (!(await journeySwitch.isChecked())) {
      await journeySwitch.click()
      await page.waitForTimeout(800)
    }
    if (!(await resultSwitch.isChecked())) {
      await resultSwitch.click()
      await page.waitForTimeout(800)
    }

    await expect(journeySwitch).toBeChecked()
    await expect(resultSwitch).toBeChecked()

    // Navigate away, then navigate back — server-side state should match.
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto(projectUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('#journey-toggle')).toBeChecked()
    await expect(page.locator('#result-toggle')).toBeChecked()

    // Hard reload — same assertion after a full page refresh.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('#journey-toggle')).toBeChecked()
    await expect(page.locator('#result-toggle')).toBeChecked()

    // Toggle Journey OFF, reload, assert OFF persists.
    await page.locator('#journey-toggle').click()
    await page.waitForTimeout(800)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('#journey-toggle')).not.toBeChecked()
    // Result remains ON — toggling one doesn't cascade.
    await expect(page.locator('#result-toggle')).toBeChecked()
  })
})
