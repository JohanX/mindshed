import { test, expect } from '@playwright/test'
import { seedHobby, seedProject, deleteHobbyCascade } from './helpers/db-seed'

// Issue #19 — lightbox controls polish.
//
// 1. Buttons must sit at consistent VIEWPORT-relative positions
//    regardless of image size. Pre-fix, controls were `absolute` to
//    the DialogContent which shrinks to wrap the image (Story 29.1) —
//    small images put the buttons on top of the image. The fix uses
//    `position: fixed` on the controls so they're positioned relative
//    to the viewport. The lightbox open/close keyframes were also
//    changed from scale+opacity to opacity-only because a `transform`
//    on a `fixed` descendant's ancestor establishes a new containing
//    block that breaks the viewport positioning during the animation.
// 2. Opening the lightbox via mouse click must not leave the close
//    button focused. Pre-fix, Radix auto-focused the first focusable
//    inside Content (the close button), and browsers matched
//    `:focus-visible` on that programmatic focus, so the close button
//    got an orange ring on every mouse-click open. The fix passes
//    `onOpenAutoFocus={(e) => e.preventDefault()}` so Radix skips the
//    initial focus move; Tab still drops focus into the dialog as
//    expected (real keyboard nav DOES light the ring, intentionally).
// 3. Clicking a control must not dismiss the dialog. Controls remain
//    DOM children of Content, so Radix's outside-click logic correctly
//    treats them as "inside" — but the test guards against future
//    refactors that move controls out without restoring the dismissal
//    suppression.

test.describe.configure({ mode: 'serial' })

test.describe('Lightbox controls polish (issue #19)', () => {
  let testPrefix: string
  let hobbyId: string
  let projectId: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `LB-CTRL-${browserName}-${Date.now()}`

    const hobby = await seedHobby({
      name: `${testPrefix} Hobby`,
      color: 'hsl(25, 45%, 40%)',
    })
    hobbyId = hobby.id

    const seeded = await seedProject({
      hobbyId,
      name: `${testPrefix} Project`,
      steps: [{ name: 'Step with images', state: 'IN_PROGRESS' }],
    })
    projectId = seeded.project.id
    const stepId = seeded.steps[0].id

    // Seed two images at very different sizes so we can prove button
    // placement is invariant. The first is small (300×450) — the case
    // that triggered the original symptom because DialogContent
    // shrinks to wrap it. The second is large (1600×1200).
    const pg = await import('pg')
    const client = new pg.default.Client({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://mindshed:mindshed@localhost:5432/mindshed_test',
    })
    await client.connect()
    await client.query(
      `INSERT INTO step_image (id, step_id, type, url, original_filename, content_type, size_bytes, created_at)
       VALUES ($1, $2, 'LINK', 'https://picsum.photos/seed/lb-ctrl-small/300/450', 'small.jpg', 'image/jpeg', 12345, now())`,
      [crypto.randomUUID(), stepId],
    )
    await client.query(
      `INSERT INTO step_image (id, step_id, type, url, original_filename, content_type, size_bytes, created_at)
       VALUES ($1, $2, 'LINK', 'https://picsum.photos/seed/lb-ctrl-large/1600/1200', 'large.jpg', 'image/jpeg', 12345, now() + interval '1 second')`,
      [crypto.randomUUID(), stepId],
    )
    await client.end()
  })

  test.afterAll(async () => {
    if (hobbyId) await deleteHobbyCascade(hobbyId)
  })

  test('controls sit at viewport edges regardless of image size', async ({ page }) => {
    const viewport = { width: 1280, height: 800 }
    await page.setViewportSize(viewport)
    await page.goto(`/hobbies/${hobbyId}/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    // Scope to the View buttons only — the gallery also renders an
    // overlapping delete button per item, so a bare `button` selector
    // would match twice as many elements as there are images.
    const thumbnails = page.locator('[data-testid="image-gallery"] button[aria-label^="View"]')
    await expect(thumbnails.first()).toBeVisible()

    // The two thumbnails are ordered by createdAt asc (Story 34.2);
    // the small image was inserted first, so it's index 0.
    for (const index of [0, 1]) {
      await thumbnails.nth(index).click()

      const lightbox = page.getByTestId('image-lightbox')
      await expect(lightbox).toBeVisible({ timeout: 5000 })

      // Wait for the lightbox image to be loaded and the open animation
      // to settle so the controls have their final layout.
      const image = page.getByTestId('lightbox-image')
      await expect(image).toBeVisible()

      const close = page.getByTestId('lightbox-close')
      const prev = page.getByTestId('lightbox-prev')
      const next = page.getByTestId('lightbox-next')

      // Close: 12 px (right-3) + 44 px (h-11 w-11) = right edge 12 px
      // from viewport right. Allow a few px slop for sub-pixel rounding.
      await expect
        .poll(async () => {
          const box = await close.boundingBox()
          return box ? viewport.width - (box.x + box.width) : Infinity
        })
        .toBeLessThan(20)

      // Prev: left edge ~12 px from viewport left.
      await expect
        .poll(async () => {
          const box = await prev.boundingBox()
          return box ? box.x : Infinity
        })
        .toBeLessThan(20)

      // Next: right edge ~12 px from viewport right.
      await expect
        .poll(async () => {
          const box = await next.boundingBox()
          return box ? viewport.width - (box.x + box.width) : Infinity
        })
        .toBeLessThan(20)

      // Close the lightbox before the next iteration.
      await page.keyboard.press('Escape')
      await expect(lightbox).toBeHidden({ timeout: 2000 })
    }
  })

  test('mouse-click open does not focus the close button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/hobbies/${hobbyId}/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    const thumbnail = page
      .locator('[data-testid="image-gallery"] button[aria-label^="View"]')
      .first()
    await thumbnail.click()

    const lightbox = page.getByTestId('image-lightbox')
    await expect(lightbox).toBeVisible({ timeout: 5000 })

    // Pre-fix, Radix's auto-focus put `.focus()` on the first
    // focusable inside Content (the close button). Browsers match
    // `:focus-visible` on that programmatic focus, so the close button
    // got an orange ring on every mouse-click open. With controls
    // moved out of Content (issue #19), the only focusable inside
    // Content is now the dialog itself — Radix's focus trap falls
    // back to focusing Content (which has `outline-none`). Both
    // assertions below should hold:
    //
    //   • the active element is not the close button (heuristic-
    //     independent — checks DOM focus directly), and
    //   • `:focus-visible` does not match on the close button.
    const closeIsActive = await page.evaluate(() => {
      const close = document.querySelector('[data-testid="lightbox-close"]')
      return close !== null && document.activeElement === close
    })
    expect(closeIsActive).toBe(false)

    const closeFocusVisible = await page
      .getByTestId('lightbox-close')
      .evaluate((el) => el.matches(':focus-visible'))
    expect(closeFocusVisible).toBe(false)
  })

  test('clicking a control does NOT close the lightbox', async ({ page }) => {
    // Controls are DOM children of DialogContent (positioned via
    // `fixed` against the viewport, but DOM-wise inside Content). A
    // click on Next must advance the counter and keep the dialog
    // open — the regression to guard against is a future refactor
    // moving controls outside Content without preserving Radix's
    // outside-click suppression.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/hobbies/${hobbyId}/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    const thumbnail = page
      .locator('[data-testid="image-gallery"] button[aria-label^="View"]')
      .first()
    await thumbnail.click()

    const lightbox = page.getByTestId('image-lightbox')
    await expect(lightbox).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('lightbox-image')).toBeVisible()

    // Click Next — the dialog must remain visible and the counter
    // must advance to the second image.
    await page.getByTestId('lightbox-next').click()
    await expect(lightbox).toBeVisible()
    await expect(page.getByTestId('lightbox-counter')).toContainText('2 of 2')
  })
})
