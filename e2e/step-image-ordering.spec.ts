import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { seedHobby, seedProject, deleteHobbyCascade, type SeededHobby } from './helpers/db-seed'

/**
 * Story 34.2 / FR131 — Step image lists ordered ASC by createdAt.
 *
 * End-to-end coverage that the data-layer flip propagates through:
 *   (1) the EXPANDED step's photo gallery grid (`<ImageGallery>`)
 *   (2) the lightbox carousel's initial image
 *   (3) the lightbox carousel's forward-navigation order (Next button)
 *
 * (The COLLAPSED step's thumbnail strip — `<StepThumbnailStrip>` —
 * shares the same source data so the same fix applies, but isn't
 * directly asserted here because the seeded single-step project
 * auto-expands its only step at mount via the existing focus-scroll
 * logic. A separate spec covering collapsed strips on multi-step
 * projects is a follow-up.)
 *
 * Strategy: seed three step images with explicit createdAt
 * timestamps t1 < t2 < t3 and INTENTIONALLY non-monotonic filenames
 * — alphabetical order does NOT match createdAt order, so a
 * hypothetical regression that swapped the orderBy column to
 * `originalFilename` would surface as a failure rather than passing
 * by coincidence.
 */

test.describe('Step image ordering ASC by createdAt (Story 34.2 / FR131)', () => {
  test.describe.configure({ mode: 'serial' })
  let hobby: SeededHobby
  let projectId: string
  let stepId: string
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `SIO-${browserName}-${Date.now()}`
    hobby = await seedHobby({
      name: `${testPrefix} Hobby`,
      color: 'hsl(200, 60%, 50%)',
    })
    const seeded = await seedProject({
      hobbyId: hobby.id,
      name: `${testPrefix} Project`,
      steps: [{ name: 'Step One' }],
    })
    projectId = seeded.project.id
    stepId = seeded.steps[0].id

    // Seed three step images with explicit created_at timestamps so the
    // ASC ordering is deterministic. Use raw SQL — there's no shared
    // seedStepImage helper (matches the pattern in
    // `lightbox-backdrop-dismiss.spec.ts`).
    const pg = await import('pg')
    const client = new pg.default.Client({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://mindshed:mindshed@localhost:5432/mindshed_test',
    })
    await client.connect()
    const baseTime = Date.now() - 3 * 60_000 // 3 minutes ago
    // Filenames intentionally NON-monotonic alphabetically vs createdAt:
    // alphabetical: 'gamma' < 'kappa' < 'zulu' (z, k, g)
    // chronological:    zulu  <  gamma  < kappa
    // A regression that swapped orderBy to `originalFilename` would
    // produce 'gamma → kappa → zulu' and FAIL these assertions instead
    // of passing by coincidence.
    const samples: Array<{ filename: string; offsetMs: number }> = [
      { filename: 'zulu-oldest.jpg', offsetMs: 0 },
      { filename: 'gamma-middle.jpg', offsetMs: 60_000 },
      { filename: 'kappa-newest.jpg', offsetMs: 120_000 },
    ]
    for (const sample of samples) {
      await client.query(
        `INSERT INTO step_image (id, step_id, type, url, original_filename, content_type, size_bytes, created_at)
         VALUES ($1, $2, 'LINK', $3, $4, 'image/jpeg', 1000, to_timestamp($5 / 1000.0))`,
        [
          randomUUID(),
          stepId,
          `https://picsum.photos/seed/sio-${sample.filename}/300/300`,
          sample.filename,
          baseTime + sample.offsetMs,
        ],
      )
    }
    await client.end()
  })

  test.afterAll(async () => {
    if (hobby?.id) await deleteHobbyCascade(hobby.id)
  })

  test('thumbnail strip + lightbox carousel show images oldest-first; Next advances chronologically', async ({
    page,
  }) => {
    await page.goto(`/hobbies/${hobby.id}/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    // The expanded step's photo gallery (`<ImageGallery>`) renders
    // thumbnails inside `[data-testid="image-gallery"]`. The first
    // thumbnail in DOM order should be the OLDEST image
    // (alt='zulu-oldest.jpg') under FR131's ASC-by-createdAt ordering —
    // NOT alphabetical order ('gamma' would be first under filename
    // sort). This assertion therefore distinguishes ASC-by-createdAt
    // from any spurious sort-by-filename regression.
    const thumbnails = page.locator('[data-testid="image-gallery"] button img')
    await expect(thumbnails).toHaveCount(3)
    await expect(thumbnails.nth(0)).toHaveAttribute('alt', 'zulu-oldest.jpg')
    await expect(thumbnails.nth(1)).toHaveAttribute('alt', 'gamma-middle.jpg')
    await expect(thumbnails.nth(2)).toHaveAttribute('alt', 'kappa-newest.jpg')

    // Click the FIRST thumbnail → lightbox opens with the OLDEST image.
    await thumbnails.nth(0).click()
    const lightbox = page.getByTestId('image-lightbox')
    await expect(lightbox).toBeVisible({ timeout: 5000 })

    const lightboxImage = page.getByTestId('lightbox-image')
    await expect(lightboxImage).toHaveAttribute('alt', 'zulu-oldest.jpg')
    await expect(page.getByTestId('lightbox-counter')).toContainText('1 of 3')

    // Forward navigation — Next button advances oldest → newest by
    // createdAt (and by INVERSE alphabetical, locking in the
    // sort-by-createdAt distinction).
    await page.getByRole('button', { name: 'Next image' }).click()
    await expect(lightboxImage).toHaveAttribute('alt', 'gamma-middle.jpg')
    await expect(page.getByTestId('lightbox-counter')).toContainText('2 of 3')

    await page.getByRole('button', { name: 'Next image' }).click()
    await expect(lightboxImage).toHaveAttribute('alt', 'kappa-newest.jpg')
    await expect(page.getByTestId('lightbox-counter')).toContainText('3 of 3')

    await page.getByTestId('lightbox-close').click()
    await expect(lightbox).not.toBeVisible()
  })
})
