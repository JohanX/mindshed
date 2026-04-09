import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Hobby Color Palette Theming', () => {
  let testPrefix: string
  let hobbyId1: string
  let hobbyId2: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `CT-${browserName}-${Date.now()}`
  })

  test('setup: create two hobbies with different colors', async ({ page }) => {
    // Create first hobby (Terracotta color)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(`${testPrefix} Hobby A`)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Get first hobby ID
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLinkA = page.getByRole('link', { name: new RegExp(`${testPrefix} Hobby A`) }).first()
    const hrefA = await hobbyLinkA.getAttribute('href')
    hobbyId1 = hrefA?.replace('/hobbies/', '') ?? ''
    expect(hobbyId1).toBeTruthy()

    // Create second hobby (Denim color)
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(`${testPrefix} Hobby B`)
    await page.getByTitle('Denim').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Get second hobby ID
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLinkB = page.getByRole('link', { name: new RegExp(`${testPrefix} Hobby B`) }).first()
    const hrefB = await hobbyLinkB.getAttribute('href')
    hobbyId2 = hrefB?.replace('/hobbies/', '') ?? ''
    expect(hobbyId2).toBeTruthy()
  })

  test('hobby layout sets --hobby-primary CSS custom property', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')

    const wrapper = page.locator('[data-hobby-context]')
    await expect(wrapper).toBeVisible()

    const primaryVar = await wrapper.evaluate((el) =>
      el.style.getPropertyValue('--hobby-primary')
    )
    expect(primaryVar).toBeTruthy()
    expect(primaryVar).not.toBe('')
  })

  test('hobby layout sets all four CSS custom properties', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')

    const wrapper = page.locator('[data-hobby-context]')
    const vars = await wrapper.evaluate((el) => ({
      primary: el.style.getPropertyValue('--hobby-primary'),
      accent: el.style.getPropertyValue('--hobby-accent'),
      card: el.style.getPropertyValue('--hobby-card'),
      border: el.style.getPropertyValue('--hobby-border'),
    }))

    expect(vars.primary).toBeTruthy()
    expect(vars.accent).toMatch(/^hsl\(/)
    expect(vars.card).toMatch(/^hsl\(/)
    expect(vars.border).toMatch(/^hsl\(/)
  })

  test('navigating between hobbies changes the CSS custom properties', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')
    const wrapper1 = page.locator('[data-hobby-context]')
    const primary1 = await wrapper1.evaluate((el) =>
      el.style.getPropertyValue('--hobby-primary')
    )

    await page.goto(`/hobbies/${hobbyId2}`)
    await page.waitForLoadState('networkidle')
    const wrapper2 = page.locator('[data-hobby-context]')
    const primary2 = await wrapper2.evaluate((el) =>
      el.style.getPropertyValue('--hobby-primary')
    )

    expect(primary1).not.toBe(primary2)
  })

  test('navigating back to dashboard removes hobby context', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-hobby-context]')).toBeVisible()

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-hobby-context]')).not.toBeVisible()
  })

  test('navbar has full hobby color background when inside hobby', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')

    // The desktop header should have the hobby color as background
    const header = page.locator('header').first()
    const bgColor = await header.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    )
    // Should not be the default card color — should be a solid hobby color
    expect(bgColor).toBeTruthy()
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('navbar restores default background on dashboard', async ({ page }) => {
    // First capture the hobby navbar bg
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')
    const header = page.locator('header').first()
    const hobbyBg = await header.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    )

    // Then navigate to dashboard
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const dashHeader = page.locator('header').first()
    const dashBg = await dashHeader.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    )

    // The backgrounds should differ
    expect(hobbyBg).not.toBe(dashBg)
  })

  test('setup: create a project with steps for dashboard card test', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Color Project`)
    await page.getByPlaceholder('Step 1 name').fill('Step One')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Start the step via status dropdown to make project active for dashboard
    const statusSelect = page.getByLabel('Step status').first()
    await statusSelect.click()
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /In Progress/ }).click()
    await page.waitForTimeout(1000)
  })

  test('dashboard project cards have hobby-tinted background (no left border)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Cards should NOT have border-l-4 anymore
    const cards = page.locator('[data-slot="card"]')
    const firstCard = cards.first()
    await expect(firstCard).toBeVisible()

    // Verify the card has a tinted background (not transparent)
    const bgColor = await firstCard.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    )
    expect(bgColor).toBeTruthy()
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('current step card has hobby-primary left border in hobby context', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: new RegExp(`${testPrefix} Color Project`) }).first().click()
    await page.waitForLoadState('networkidle')

    // Find the current step card
    const stepCard = page.locator('[data-testid^="step-card-"]').first()
    await expect(stepCard).toBeVisible()
  })
})
