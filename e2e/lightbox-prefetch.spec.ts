import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { seedHobby, seedProject, deleteHobbyCascade, type SeededHobby } from './helpers/db-seed'

/**
 * Story 34.4 / FR133 — Lightbox prefetch + size stabilization.
 *
 * The bug: clicking Next on the lightbox while the image is mid-fetch
 * caused DialogContent (sm:w-auto sm:h-auto on desktop) to collapse,
 * making the absolute-positioned controls (prev / next / close /
 * delete / counter) clump in the middle of the viewport with the
 * spinner on top.
 *
 * The fix: cache the previous image's rendered bounding box and apply
 * as min-width/min-height on the image-area div while `imageLoading`
 * is true. DialogContent stays sized to the previous photo's
 * footprint until the new image arrives.
 *
 * This spec intercepts the second image's network request to delay it,
 * forcing the slow-load path that the size-stabilization is meant to
 * cover. Asserts the dialog box stays non-zero (and roughly the same
 * size as before the click) during the delay window.
 */

test.describe('Lightbox prefetch + size stabilization (Story 34.4 / FR133)', () => {
  test.describe.configure({ mode: 'serial' })
  let hobby: SeededHobby
  let projectId: string
  let stepId: string
  let testPrefix: string

  // Use distinct picsum seeds so the two images have predictable
  // distinct URLs we can intercept independently. The delayed URL is
  // captured for the page.route handler.
  const FIRST_IMAGE_SEED = 'lpx-first'
  const SECOND_IMAGE_SEED = 'lpx-second'
  const firstImageUrl = `https://picsum.photos/seed/${FIRST_IMAGE_SEED}/600/400`
  const secondImageUrl = `https://picsum.photos/seed/${SECOND_IMAGE_SEED}/600/400`

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `LPX-${browserName}-${Date.now()}`
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

    // Seed two LINK step images with explicit createdAt offsets — ASC
    // ordering (FR131 / Story 34.2) means the first image is at index
    // 0 and the second at index 1. Raw SQL pattern matches
    // step-image-ordering.spec.ts and lightbox-backdrop-dismiss.spec.ts.
    const pg = await import('pg')
    const client = new pg.default.Client({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://mindshed:mindshed@localhost:5432/mindshed_test',
    })
    await client.connect()
    const baseTime = Date.now() - 2 * 60_000
    const samples = [
      { url: firstImageUrl, filename: 'first.jpg', offsetMs: 0 },
      { url: secondImageUrl, filename: 'second.jpg', offsetMs: 60_000 },
    ]
    for (const sample of samples) {
      await client.query(
        `INSERT INTO step_image (id, step_id, type, url, original_filename, content_type, size_bytes, created_at)
         VALUES ($1, $2, 'LINK', $3, $4, 'image/jpeg', 1000, to_timestamp($5 / 1000.0))`,
        [randomUUID(), stepId, sample.url, sample.filename, baseTime + sample.offsetMs],
      )
    }
    await client.end()
  })

  test.afterAll(async () => {
    if (hobby?.id) await deleteHobbyCascade(hobby.id)
  })

  test('dialog stays sized during slow-load on Next; spinner shows; image renders on response', async ({
    browser,
  }) => {
    // Use a fresh context so route interception doesn't leak between
    // tests. Desktop viewport (1280×800) so DialogContent's
    // sm:w-auto sm:h-auto path is the one under test (mobile path is
    // 100dvh × 100vw and doesn't collapse).
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      storageState: 'e2e/.auth/state.json',
    })
    const page = await context.newPage()

    // Delay the SECOND image's network response so the click-Next path
    // hits the size-stabilization branch.
    //
    // Critical: the production `useEffect` issues a prefetch for
    // `secondImageUrl` as soon as the FIRST image is at index 0 (i.e.
    // immediately on lightbox open). That prefetch hits this route and
    // the 3500 ms delay starts ticking. The test's "wait for first
    // image to load + capture beforeBox + click Next" sequence runs in
    // parallel, taking <1.5 s. So when the user clicks Next, the
    // prefetch is STILL pending → the visible `<img>`'s request for
    // `secondImageUrl` joins the same in-flight network operation
    // (browser dedup), and the slow-load path is exercised
    // deterministically. A short delay (~1500 ms) raced because the
    // prefetch sometimes completed before click-Next.
    await page.route(secondImageUrl, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3500))
      await route.continue()
    })

    try {
      await page.goto(`/hobbies/${hobby.id}/projects/${projectId}`)
      await page.waitForLoadState('networkidle')

      // Open the lightbox via the FIRST thumbnail in the expanded
      // step's image gallery (FR131: ASC order, index 0 = oldest).
      const firstThumb = page.locator('[data-testid="image-gallery"] button img').first()
      await expect(firstThumb).toBeVisible()
      await firstThumb.click()

      const lightboxImage = page.getByTestId('lightbox-image')
      // Wait for the first image to fully load + render.
      await expect(lightboxImage).toBeVisible({ timeout: 5000 })
      await page.waitForFunction(
        () => {
          const img = document.querySelector(
            '[data-testid="lightbox-image"]',
          ) as HTMLImageElement | null
          return img !== null && img.complete && img.naturalWidth > 0
        },
        undefined,
        { timeout: 5000 },
      )

      // Capture the dialog content's bbox BEFORE click.
      const dialogContent = page.getByTestId('image-lightbox')
      const beforeBox = await dialogContent.boundingBox()
      if (!beforeBox) throw new Error('dialog content bbox unavailable before click')
      expect(beforeBox.width).toBeGreaterThan(100)
      expect(beforeBox.height).toBeGreaterThan(100)

      // Click Next — triggers the slow-load path because we delayed the
      // second image's response by 1500 ms above.
      await page.getByRole('button', { name: 'Next image' }).click()

      // While the response is still in flight (~200 ms after click),
      // the dialog SHOULD stay roughly the same size — this is the
      // regression-test contract. Without size stabilization the
      // dialog would collapse to near-zero on desktop.
      await page.waitForTimeout(200)
      const duringBox = await dialogContent.boundingBox()
      if (!duringBox) throw new Error('dialog content bbox unavailable during load')
      // ±20 px slack to account for any minor reflow.
      expect(Math.abs(duringBox.width - beforeBox.width)).toBeLessThanOrEqual(20)
      expect(Math.abs(duringBox.height - beforeBox.height)).toBeLessThanOrEqual(20)

      // Spinner should be visible during the wait.
      await expect(page.getByTestId('lightbox-image-loading')).toBeVisible()

      // Wait for the delayed response to complete; assert the new
      // image renders. (Counter advances to 2 of 2 immediately on
      // click — that's React state, not gated on network.)
      await expect(page.getByTestId('lightbox-counter')).toContainText('2 of 2')
      await page.waitForFunction(
        () => {
          const img = document.querySelector(
            '[data-testid="lightbox-image"]',
          ) as HTMLImageElement | null
          return img !== null && img.complete && img.naturalWidth > 0
        },
        undefined,
        { timeout: 10_000 },
      )
      await expect(page.getByTestId('lightbox-image-loading')).not.toBeVisible()
    } finally {
      await context.close()
    }
  })
})
