import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { seedHobby, seedProject, seedStepImage, deleteHobbyCascade } from './helpers/db-seed'
import { putMinioObject, deleteMinioObject, syntheticMp4Buffer } from './helpers/minio'

/**
 * Story 35.4 / FR137 — load-bearing MinIO video round-trip.
 *
 * Proves the full S3-mode contract end-to-end:
 *   1. A real MP4 byte buffer is PUT to MinIO at a storage key
 *   2. A VIDEO `step_image` row points at that key
 *   3. The project's journey gallery is enabled with a slug
 *   4. The public gallery URL renders the VIDEO tile as a generic
 *      play-icon card (S3 mode → `getVideoPosterUrl` returns null)
 *   5. Clicking the tile opens the lightbox
 *   6. The lightbox mounts a `<video>` element with the storage URL
 *
 * The 200-on-video-URL assertion is intentionally limited to network
 * request inspection rather than full playback — the synthetic MP4
 * buffer is not a real playable encoding. Real playback is the user's
 * job; storage-layer correctness is what this test locks down.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://mindshed:mindshed@localhost:5432/mindshed_test'

async function enableJourneyGallery(projectId: string, gallerySlug: string): Promise<void> {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `UPDATE project SET journey_gallery_enabled = true, gallery_slug = $1 WHERE id = $2`,
      [gallerySlug, projectId],
    )
  } finally {
    await client.end()
  }
}

// Webkit-engine has its own load-bearing lightbox spec
// (`lightbox-video-ios.spec.ts`); this round-trip is about storage-layer
// correctness, not browser-engine quirks. Chromium-only.
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'round-trip exercises storage layer; chromium-only smoke is sufficient',
)

test.describe.configure({ mode: 'serial' })

test.describe('MinIO video round-trip (Story 35.4 / FR137)', () => {
  let hobbyId: string | null = null
  let storageKey: string | null = null

  test.afterEach(async () => {
    if (storageKey) {
      await deleteMinioObject(storageKey)
      storageKey = null
    }
    if (hobbyId) {
      await deleteHobbyCascade(hobbyId).catch(() => {})
      hobbyId = null
    }
  })

  test('S3 mode: PUT to MinIO → public-gallery render → lightbox <video> mount', async ({
    page,
  }) => {
    const hobby = await seedHobby({ name: `RoundTrip-${Date.now()}` })
    hobbyId = hobby.id
    const seeded = await seedProject({
      hobbyId: hobby.id,
      name: `Round Trip Project ${Date.now()}`,
      steps: [{ name: 'Round Trip Step' }],
    })
    const stepId = seeded.steps[0].id
    const projectId = seeded.project.id

    storageKey = `steps/${stepId}/${randomUUID()}.mp4`
    const gallerySlug = `roundtrip-${Date.now()}-${randomUUID().slice(0, 6)}`

    await putMinioObject({
      storageKey,
      body: syntheticMp4Buffer(),
      contentType: 'video/mp4',
    })
    await seedStepImage({
      stepId,
      type: 'UPLOAD',
      mediaType: 'VIDEO',
      storageKey,
      contentType: 'video/mp4',
      sizeBytes: 8,
      durationSeconds: 10,
      originalFilename: 'roundtrip.mp4',
    })
    await enableJourneyGallery(projectId, gallerySlug)

    // ── Step 1: public journey-gallery URL renders the VIDEO tile.
    // Note: the gallery routes are public — no auth required, so this
    // tests the surface as a share-link recipient sees it.
    await page.goto(`/gallery/${gallerySlug}`)
    await page.waitForLoadState('networkidle')

    const playOverlay = page.getByTestId('video-play-overlay').first()
    await expect(playOverlay).toBeVisible({ timeout: 10_000 })

    // No `<video>` should be on the page at tile-size (FR137 contract).
    expect(await page.locator('video').count()).toBe(0)

    // ── Step 2: open the lightbox.
    // Capture network requests so we can assert the video URL is hit.
    const videoUrlRequests: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (storageKey && url.includes(storageKey)) {
        videoUrlRequests.push(url)
      }
    })

    // Click the gallery-tile button (more reliable than the inner play
    // overlay, which has `pointer-events-none` and so propagates through
    // to the button anyway, but Playwright's hit-testing under load is
    // less flaky when targeting the actual interactive element).
    await page
      .getByRole('button', { name: /View .*roundtrip/ })
      .first()
      .click()

    // The lightbox renders a `<video>` for VIDEO items. Wait for it
    // via the stable Story 35.3 test-id. Note that the synthetic MP4
    // buffer is unplayable, which triggers `<video>` `onError` → the
    // lightbox switches to broken-state and unmounts the `<video>`.
    // The mount itself is the assertion that matters; the broken-state
    // transition is acceptable for this storage-layer round-trip.
    const videoEl = page.getByTestId('lightbox-video')
    await expect(videoEl).toBeVisible({ timeout: 15_000 })

    // ── Step 3: assert the browser DID request the MinIO URL. This is
    // the load-bearing storage-layer assertion — the lightbox `<video>`
    // mount triggered a metadata fetch against the MinIO endpoint, so
    // the data path Cloudinary → adapter → `<video src=…>` is intact.
    // Network capture is decoupled from the `<video>` lifetime so a
    // post-mount broken-state transition doesn't race the assertion.
    await expect.poll(() => videoUrlRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)

    // Confirm the captured URL matches our storage key (the listener
    // already filters on storageKey via `url.includes(storageKey)`, so
    // this is a defense-in-depth recheck).
    expect(videoUrlRequests.some((url) => url.includes(storageKey!))).toBe(true)
  })
})
