import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Ideation Pipeline', () => {
  let testPrefix: string
  let hobbyName: string
  let hobbyIdeasUrl: string

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
    const hobbyLink = page.getByRole('link', { name: new RegExp(`${hobbyName}.*projects`) })
    await expect(hobbyLink).toBeVisible()
    const href = await hobbyLink.getAttribute('href')
    hobbyIdeasUrl = `${href}/ideas`
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

  test('global ideas page shows ideas from multiple hobbies with hobby badges', async ({ page }) => {
    // Create a second hobby and add an idea to it
    const secondHobbyName = `${testPrefix} Painting`
    await page.goto('/hobbies')
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(secondHobbyName)
    await page.getByTitle('Denim').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: new RegExp(`${secondHobbyName}.*projects`) })).toBeVisible()

    // Create an idea from global page for the second hobby
    await page.goto('/ideas')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'New Idea' }).first().click()
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: new RegExp(secondHobbyName) }).click()
    await page.getByPlaceholder("What's the idea?").fill(`${testPrefix} Cross Hobby Idea`)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(`${testPrefix} Cross Hobby Idea`)).toBeVisible()

    // Verify badges from both hobbies are visible
    await expect(page.getByText(hobbyName).first()).toBeVisible()
    await expect(page.getByText(secondHobbyName).first()).toBeVisible()
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

    // Get the hobby URL from the link, then navigate to its ideas page
    const hobbyLink = page.getByRole('link', { name: new RegExp(`${emptyHobbyName}.*projects`) })
    const hobbyHref = await hobbyLink.getAttribute('href')
    await page.goto(`${hobbyHref}/ideas`)
    await page.waitForLoadState('networkidle')

    // Verify empty state
    await expect(page.getByText('No ideas captured yet. When inspiration strikes, add it here.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Idea' }).first()).toBeVisible()
  })

  test('can edit an idea via dropdown', async ({ page }) => {
    await page.goto(hobbyIdeasUrl)
    await page.waitForLoadState('networkidle')

    // Open dropdown on first idea
    const actionsBtn = page.getByRole('button', { name: 'Idea actions' }).first()
    await expect(actionsBtn).toBeVisible()
    await actionsBtn.click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    // Edit the title
    const titleInput = page.getByLabel('Title')
    await titleInput.clear()
    await titleInput.fill('Edited Idea Title')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Verify updated
    await page.goto(hobbyIdeasUrl)
    await expect(page.getByText('Edited Idea Title')).toBeVisible()
  })

  test('can delete an idea via dropdown', async ({ page }) => {
    // Create a throwaway idea
    await page.goto(hobbyIdeasUrl)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'New Idea' }).first().click()
    await page.getByLabel('Title').fill('Delete Me Idea')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto(hobbyIdeasUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Delete Me Idea')).toBeVisible()

    // Delete via dropdown
    // Find the card with "Delete Me Idea" and its actions button
    const cards = page.getByTestId('idea-card')
    const targetCard = cards.filter({ hasText: 'Delete Me Idea' })
    await targetCard.getByRole('button', { name: 'Idea actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(1000)

    await page.goto(hobbyIdeasUrl)
    await expect(page.getByText('Delete Me Idea')).not.toBeVisible()
  })

  test('can promote an idea to a project', async ({ page }) => {
    // Create an idea to promote
    await page.goto(hobbyIdeasUrl)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'New Idea' }).first().click()
    await page.getByLabel('Title').fill('Promote Me Idea')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto(hobbyIdeasUrl)
    await page.waitForLoadState('networkidle')

    // Promote via dropdown
    const cards = page.getByTestId('idea-card')
    const targetCard = cards.filter({ hasText: 'Promote Me Idea' })
    await targetCard.getByRole('button', { name: 'Idea actions' }).click()
    await page.getByRole('menuitem', { name: 'Promote to Project' }).click()
    await page.waitForTimeout(1000)

    // Verify idea is marked as promoted (muted styling)
    await page.goto(hobbyIdeasUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Promoted').first()).toBeVisible()

    // Verify project was created on the hobby page
    const hobbyUrl = hobbyIdeasUrl.replace('/ideas', '')
    await page.goto(hobbyUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Promote Me Idea').first()).toBeVisible()
  })
})
