import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Ideation Pipeline', () => {
  let testPrefix: string
  let hobbyName: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `IP-${browserName}-${Date.now()}`
    hobbyName = `${testPrefix} Craft`
  })

  test('setup: create a hobby for ideation tests', async ({ page }) => {
    await page.goto('/hobbies')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })).toBeVisible()
  })

  test('can create idea with title only on hobby ideas page', async ({ page }) => {
    await page.goto('/hobbies')
    // Navigate to hobby detail page
    await page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) }).click()
    await page.waitForLoadState('networkidle')

    // Navigate to ideas sub-page
    await page.goto(page.url().replace(/\/?$/, '/ideas'))
    await page.waitForLoadState('networkidle')

    // Open idea form
    await page.getByRole('button', { name: 'New Idea' }).first().click()
    await page.getByPlaceholder("What's the idea?").fill(`${testPrefix} Simple Idea`)
    await page.getByRole('button', { name: 'Save' }).click()

    // Verify the idea appears
    await expect(page.getByText(`${testPrefix} Simple Idea`)).toBeVisible()
  })

  test('can create idea with all fields', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) }).click()
    await page.waitForLoadState('networkidle')
    await page.goto(page.url().replace(/\/?$/, '/ideas'))
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'New Idea' }).first().click()
    await page.getByPlaceholder("What's the idea?").fill(`${testPrefix} Full Idea`)
    await page.getByPlaceholder('Add some details...').fill('A detailed description of the idea')
    await page.getByPlaceholder('https://...').fill('https://example.com/reference')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText(`${testPrefix} Full Idea`)).toBeVisible()
    await expect(page.getByText('A detailed description of the idea')).toBeVisible()
  })

  test('shows validation error for empty title', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) }).click()
    await page.waitForLoadState('networkidle')
    await page.goto(page.url().replace(/\/?$/, '/ideas'))
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'New Idea' }).first().click()
    // Title is empty, save button should be disabled
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('shows validation error for invalid URL', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) }).click()
    await page.waitForLoadState('networkidle')
    await page.goto(page.url().replace(/\/?$/, '/ideas'))
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'New Idea' }).first().click()
    await page.getByPlaceholder("What's the idea?").fill(`${testPrefix} Bad URL Idea`)
    await page.getByPlaceholder('https://...').fill('not-a-url')
    await page.getByRole('button', { name: 'Save' }).click()

    // Should show inline error
    await expect(page.getByText('Please enter a valid URL')).toBeVisible()
  })

  test('ideas appear on global ideas page with hobby badge', async ({ page }) => {
    await page.goto('/ideas')
    await page.waitForLoadState('networkidle')

    // Ideas created earlier should be visible
    await expect(page.getByText(`${testPrefix} Simple Idea`)).toBeVisible()
    await expect(page.getByText(`${testPrefix} Full Idea`)).toBeVisible()
    // Hobby badge should be visible
    await expect(page.getByText(hobbyName).first()).toBeVisible()
  })

  test('can create idea from global ideas page with hobby selector', async ({ page }) => {
    await page.goto('/ideas')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'New Idea' }).first().click()
    // Should see hobby selector
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: new RegExp(hobbyName) }).click()
    await page.getByPlaceholder("What's the idea?").fill(`${testPrefix} Global Idea`)
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText(`${testPrefix} Global Idea`)).toBeVisible()
  })

  test('hobby ideas page shows idea cards after creating an idea', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) }).click()
    await page.waitForLoadState('networkidle')
    await page.goto(page.url().replace(/\/?$/, '/ideas'))
    await page.waitForLoadState('networkidle')

    // Should show idea cards for previously created ideas
    const cards = page.getByTestId('idea-card')
    await expect(cards.first()).toBeVisible()
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('hobby ideas page shows breadcrumbs', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) }).click()
    await page.waitForLoadState('networkidle')
    await page.goto(page.url().replace(/\/?$/, '/ideas'))
    await page.waitForLoadState('networkidle')

    // Breadcrumbs: Hobbies > <hobby name> > Ideas
    const breadcrumb = page.getByLabel('breadcrumb')
    await expect(breadcrumb.getByRole('link', { name: 'Hobbies' })).toBeVisible()
    await expect(breadcrumb.getByRole('link', { name: hobbyName })).toBeVisible()
    await expect(breadcrumb.getByText('Ideas')).toBeVisible()
  })

  test('empty hobby ideas page shows empty state message', async ({ page }) => {
    // Create a fresh hobby with no ideas
    const emptyHobbyName = `${testPrefix} EmptyIdeas`
    await page.goto('/hobbies')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(emptyHobbyName)
    await page.getByTitle('Terracotta').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`${emptyHobbyName}.*projects`) })).toBeVisible()

    // Navigate to the ideas page of this empty hobby
    await page.getByRole('link', { name: new RegExp(`${emptyHobbyName}.*projects`) }).click()
    await page.waitForLoadState('networkidle')
    await page.goto(page.url().replace(/\/?$/, '/ideas'))
    await page.waitForLoadState('networkidle')

    // Verify empty state
    await expect(page.getByText('No ideas captured yet. When inspiration strikes, add it here.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Idea' }).first()).toBeVisible()
  })
})
