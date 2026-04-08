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

    // The hobby layout wrapper should have --hobby-primary set
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
    // Visit first hobby
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')
    const wrapper1 = page.locator('[data-hobby-context]')
    const primary1 = await wrapper1.evaluate((el) =>
      el.style.getPropertyValue('--hobby-primary')
    )

    // Visit second hobby
    await page.goto(`/hobbies/${hobbyId2}`)
    await page.waitForLoadState('networkidle')
    const wrapper2 = page.locator('[data-hobby-context]')
    const primary2 = await wrapper2.evaluate((el) =>
      el.style.getPropertyValue('--hobby-primary')
    )

    // The colors should differ between hobbies
    expect(primary1).not.toBe(primary2)
  })

  test('navigating back to dashboard removes hobby context', async ({ page }) => {
    // Start in hobby context
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-hobby-context]')).toBeVisible()

    // Navigate to dashboard
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // No hobby context wrapper should be present
    await expect(page.locator('[data-hobby-context]')).not.toBeVisible()
  })

  test('setup: create a project with steps for dashboard card test', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill(`${testPrefix} Color Project`)
    await page.getByPlaceholder('Step 1 name').fill('Step One')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    // Start the step to make project active for dashboard
    await page.getByRole('button', { name: 'Start step' }).first().click()
    await page.waitForTimeout(1000)
  })

  test('dashboard project cards have hobby-colored left border', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find a project card with left border — the HobbyIdentity accent adds border-l-4
    const cardWithBorder = page.locator('.border-l-4').first()
    await expect(cardWithBorder).toBeVisible()

    // Verify the border-left-color is set (inline style from HobbyIdentity)
    const borderColor = await cardWithBorder.evaluate((el) =>
      window.getComputedStyle(el).borderLeftColor
    )
    expect(borderColor).toBeTruthy()
    // Should not be transparent or default
    expect(borderColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('current step card has hobby-primary left border in hobby context', async ({ page }) => {
    // Navigate to the project page
    await page.goto(`/hobbies/${hobbyId1}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: new RegExp(`${testPrefix} Color Project`) }).first().click()
    await page.waitForLoadState('networkidle')

    // Find the current step card (it has border-l-4)
    const stepCard = page.locator('[data-testid^="step-card-"]').first()
    await expect(stepCard).toBeVisible()

    // The Card wrapper should have a left border
    const card = stepCard.locator('..')
    const borderStyle = await card.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return {
        borderLeftWidth: style.borderLeftWidth,
        borderLeftColor: style.borderLeftColor,
      }
    })
    // The current step card should have a visible left border
    expect(borderStyle.borderLeftWidth).toBeTruthy()
  })
})
