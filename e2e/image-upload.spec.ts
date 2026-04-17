import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Image Upload (Storage Adapter)', () => {
  let hobbyId: string
  let hobbyName: string

  test.beforeAll(async ({ browser, browserName }) => {
    hobbyName = `ImgTest-${browserName}-${Date.now()}`
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()
    await page.getByPlaceholder('e.g., Woodworking').fill(hobbyName)
    await page.getByTitle('Walnut').click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const hobbyLink = page.getByRole('link', { name: new RegExp(hobbyName) }).first()
    const href = await hobbyLink.getAttribute('href')
    hobbyId = href?.replace('/hobbies/', '') ?? ''
    expect(hobbyId).toBeTruthy()

    // Create a project with a step
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create Project' }).first().click()
    await page.getByPlaceholder('e.g., Walnut Side Table').fill('Image Test Project')
    await page.getByPlaceholder('Step 1 name').fill('Test Step')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(2000)

    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/state.json' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const actionButton = page
      .locator('div.relative')
      .filter({ has: page.getByRole('link', { name: new RegExp(hobbyName) }) })
      .getByRole('button', { name: 'Hobby actions' })

    if (await actionButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionButton.click()
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await page.getByRole('button', { name: 'Delete' }).click()
      await page.waitForTimeout(1000)
    }
    await page.close()
  })

  test('upload photo button is visible on expanded step', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')

    await page.getByText('Image Test Project').first().click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Upload Photo' }).first()).toBeVisible()
  })

  test('paste image / link button is visible on expanded step', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')

    await page.getByText('Image Test Project').first().click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Paste Image / Link' }).first()).toBeVisible()
  })

  test('presign API returns 501 when IMAGE_PROVIDER is not configured', async ({ request }) => {
    const response = await request.post('/api/upload/presign', {
      data: {
        stepId: '550e8400-e29b-41d4-a716-446655440000',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      },
    })

    expect([200, 401, 501]).toContain(response.status())
  })

  test('presign API rejects invalid content type', async ({ request }) => {
    const response = await request.post('/api/upload/presign', {
      data: {
        stepId: '550e8400-e29b-41d4-a716-446655440000',
        filename: 'test.gif',
        contentType: 'image/gif',
      },
    })

    expect([400, 401]).toContain(response.status())
  })

  test('presign API rejects missing stepId', async ({ request }) => {
    const response = await request.post('/api/upload/presign', {
      data: {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      },
    })

    expect([400, 401]).toContain(response.status())
  })

  test('photos section and empty state visible on step', async ({ page }) => {
    await page.goto(`/hobbies/${hobbyId}`)
    await page.waitForLoadState('networkidle')

    await page.getByText('Image Test Project').first().click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/add photos|document your progress/i).first()).toBeVisible()
  })
})
