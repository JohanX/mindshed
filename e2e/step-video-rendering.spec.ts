import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { seedHobby, seedProject, deleteHobbyCascade, type SeededHobby } from './helpers/db-seed'

/**
 * Story 35.3 / FR136 — Owner-side video tile rendering (chromium).
 *
 * Smoke coverage: a step with a VIDEO step_image row renders the gallery
 * tile as a play overlay (over a poster OR a generic play-icon card,
 * depending on storage adapter). No `<video>` element at tile size.
 * Companion to `lightbox-video-ios.spec.ts` (the load-bearing webkit
 * spec) — this one runs in chromium for general smoke coverage.
 */

test.describe.configure({ mode: 'serial' })

test.describe('Step video tile rendering (Story 35.3 / FR136)', () => {
  let hobby: SeededHobby
  let projectId: string
  let stepId: string
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `SVR-${browserName}-${Date.now()}`
    hobby = await seedHobby({ name: `${testPrefix} Hobby` })
    const seeded = await seedProject({
      hobbyId: hobby.id,
      name: `${testPrefix} Project`,
      steps: [{ name: 'Test Step' }],
    })
    projectId = seeded.project.id
    stepId = seeded.steps[0].id

    // Seed one VIDEO step_image row directly via SQL. Uses a LINK-type
    // row so no storage adapter is required for the test to render
    // (the data layer's `displayUrl` falls through to the LINK url for
    // non-UPLOAD rows). The `mediaType: 'VIDEO'` triggers the tile
    // branch.
    const pg = await import('pg')
    const client = new pg.default.Client({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://mindshed:mindshed@localhost:5432/mindshed_test',
    })
    await client.connect()
    try {
      await client.query(
        `INSERT INTO step_image (id, step_id, type, url, original_filename, content_type, size_bytes, media_type, duration_seconds, created_at)
         VALUES ($1, $2, 'LINK', $3, 'clip.mp4', 'video/mp4', 5000, 'VIDEO', 10, now())`,
        [randomUUID(), stepId, 'https://picsum.photos/seed/svr-poster/640/480'],
      )
    } finally {
      await client.end()
    }
  })

  test.afterAll(async () => {
    if (hobby?.id) {
      await deleteHobbyCascade(hobby.id).catch(() => {})
    }
  })

  test('gallery tile renders play overlay for VIDEO step image', async ({ page }) => {
    await page.goto(`/hobbies/${hobby.id}/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('image-gallery')).toBeVisible({ timeout: 10_000 })
    const overlay = page.getByTestId('video-play-overlay').first()
    await expect(overlay).toBeVisible({ timeout: 10_000 })
  })

  test('no <video> element rendered at tile size', async ({ page }) => {
    await page.goto(`/hobbies/${hobby.id}/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    // Wait for the gallery to settle.
    await expect(page.getByTestId('video-play-overlay').first()).toBeVisible({
      timeout: 10_000,
    })

    // Now check no <video> exists outside the lightbox (lightbox isn't
    // open yet so the only <video> would be a tile-level one — which
    // FR137 forbids).
    const videoCount = await page.locator('video').count()
    expect(videoCount).toBe(0)
  })
})
