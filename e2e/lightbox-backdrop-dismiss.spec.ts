import { test, expect } from '@playwright/test'
import { seedHobby, seedProject, deleteHobbyCascade } from './helpers/db-seed'

// Story 32.4 — desktop lightbox backdrop dismiss.
//
// Verifies the Story 29.1 bounded-content layout still behaves correctly
// after the Story 32.3 Framer Motion refactor: at sm+ the lightbox
// content shrinks to wrap the image, the overlay around it is the dim
// backdrop, and clicking the backdrop dismisses the lightbox via
// Radix's onPointerDownOutside default.
//
// Mobile (< sm) is full-viewport so there's no useful "outside" area —
// no equivalent test needed there.

test.describe.configure({ mode: 'serial' })

test.describe('Lightbox backdrop dismiss (Story 32.4)', () => {
  let testPrefix: string
  let hobbyId: string
  let projectId: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `LB-BACKDROP-${browserName}-${Date.now()}`

    const hobby = await seedHobby({
      name: `${testPrefix} Hobby`,
      color: 'hsl(25, 45%, 40%)',
    })
    hobbyId = hobby.id

    const seeded = await seedProject({
      hobbyId,
      name: `${testPrefix} Project`,
      steps: [{ name: 'Step with image', state: 'IN_PROGRESS' }],
    })
    projectId = seeded.project.id
    const stepId = seeded.steps[0].id

    // Seed a step image so the image gallery renders a thumbnail to click.
    const pg = await import('pg')
    const client = new pg.default.Client({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://mindshed:mindshed@localhost:5432/mindshed_test',
    })
    await client.connect()
    await client.query(
      `INSERT INTO step_image (id, step_id, type, url, original_filename, content_type, size_bytes, created_at)
       VALUES ($1, $2, 'LINK', 'https://picsum.photos/seed/lb-backdrop/600/600', 'lb-backdrop.jpg', 'image/jpeg', 12345, now())`,
      [crypto.randomUUID(), stepId],
    )
    await client.end()
  })

  test.afterAll(async () => {
    if (hobbyId) await deleteHobbyCascade(hobbyId)
  })

  test('clicking the backdrop closes the lightbox at desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/hobbies/${hobbyId}/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    // Open the lightbox via the first thumbnail in the step image gallery.
    const thumbnail = page.locator('[data-testid="image-gallery"] button').first()
    await expect(thumbnail).toBeVisible()
    await thumbnail.click()

    const lightbox = page.getByTestId('image-lightbox')
    await expect(lightbox).toBeVisible({ timeout: 5000 })

    // Click the backdrop ~50 px from the viewport edge — clearly outside
    // the bounded content (which is sm:max-w-[90vw], sm:max-h-[90vh]).
    await page.mouse.click(50, 400)

    // Lightbox should be gone.
    await expect(lightbox).toBeHidden({ timeout: 2000 })
  })

  test('clicking the image itself does NOT close the lightbox', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/hobbies/${hobbyId}/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    const thumbnail = page.locator('[data-testid="image-gallery"] button').first()
    await thumbnail.click()

    const lightbox = page.getByTestId('image-lightbox')
    await expect(lightbox).toBeVisible({ timeout: 5000 })

    // Click directly on the lightbox image — should NOT dismiss.
    const image = page.getByTestId('lightbox-image')
    await expect(image).toBeVisible()
    await image.click()

    // Wait a moment to give any spurious dismissal a chance to fire.
    await page.waitForTimeout(400)

    // Still visible.
    await expect(lightbox).toBeVisible()
  })
})
