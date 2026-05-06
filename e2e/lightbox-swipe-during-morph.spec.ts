import { test, expect } from '@playwright/test'
import {
  seedHobby,
  seedInventoryItem,
  seedInventoryItemImage,
  deleteHobbyCascade,
  deleteInventoryItemsByPrefix,
  type SeededHobby,
  type SeededInventoryItem,
} from './helpers/db-seed'

/**
 * Story 34.1 / FR132 — Lightbox finger-follow swipe regression test.
 *
 * The bug was a contest between Story 32.3's `<motion.img layoutId>` morph
 * and Story 29.6's inline `transform: translateX(${dragOffset}px)` swipe
 * style on the SAME DOM element. Framer Motion's projection writer wrote
 * `transform: matrix(...)` directly to the img's `style.transform` for
 * the morph window (~220 ms), clobbering the React-managed swipe
 * transform.
 *
 * The fix splits the two transforms onto two DOM nodes:
 *   - Outer `<motion.div layoutId>` drives the morph reveal.
 *   - Inner `<img>` (no Framer wrapper) holds the swipe `translateX`.
 *
 * This test fires a synthetic touch swipe DURING the morph window and
 * asserts the inner img's computed transform reflects 29.6's translateX
 * — proving the two systems no longer contend.
 */

test.describe('Lightbox finger-follow swipe during morph (Story 34.1 / FR132)', () => {
  test.describe.configure({ mode: 'serial' })
  let hobby: SeededHobby
  let item: SeededInventoryItem
  let testPrefix: string

  test.beforeAll(async ({ browserName }) => {
    testPrefix = `LSDM-${browserName}-${Date.now()}`
    hobby = await seedHobby({ name: `${testPrefix} Hobby`, color: 'hsl(200, 60%, 50%)' })
    item = await seedInventoryItem({
      name: `${testPrefix}-item`,
      type: 'MATERIAL',
      quantity: 1,
      unit: 'kg',
    })
    // Two LINK images — picsum returns deterministic-ish content per seed.
    // The `morphLayoutId` is set on the inventory hero (`inv-hero-${itemId}`)
    // so opening the lightbox triggers the thumbnail-to-lightbox morph,
    // which is the failure window we want to test.
    await seedInventoryItemImage({
      inventoryItemId: item.id,
      type: 'LINK',
      url: 'https://picsum.photos/seed/lsdm-a/400/400',
    })
    await seedInventoryItemImage({
      inventoryItemId: item.id,
      type: 'LINK',
      url: 'https://picsum.photos/seed/lsdm-b/400/400',
    })
  })

  test.afterAll(async () => {
    await deleteInventoryItemsByPrefix(testPrefix)
    await deleteHobbyCascade(hobby.id)
  })

  test('inner img translateX tracks finger during the morph window; scale stays 1.0', async ({
    browser,
  }) => {
    const touchContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    })
    const touchPage = await touchContext.newPage()
    await touchPage.goto('/inventory')
    await touchPage.waitForLoadState('networkidle')

    // Open the lightbox via the inventory hero — triggers the morph
    // reveal driven by `morphLayoutId` on `<motion.div>` (post-Story-34.1).
    await touchPage.getByRole('button', { name: `View photos of ${item.name}` }).click()

    // Wait for the lightbox content to mount but NOT for the morph to
    // settle — we want the swipe to fire WITHIN the morph window.
    await expect(touchPage.getByTestId('image-lightbox')).toBeVisible({ timeout: 5000 })

    // Run the swipe + matrix sampling in-browser. Each pointermove sets
    // React state via `setDragOffset`; the inline-style commit only
    // reaches the DOM after React's render flush. Awaiting `rAF` between
    // dispatches gives the render a chance to land before sampling.
    // This still keeps the entire gesture well inside the morph's
    // ~220 ms window.
    const samples = await touchPage.evaluate(async () => {
      function parseMatrix(transform: string): {
        a: number
        b: number
        c: number
        d: number
        e: number
        f: number
      } | null {
        if (transform === 'none' || !transform) return null
        const match = transform.match(/matrix\(([^)]+)\)/)
        if (!match) return null
        const parts = match[1].split(',').map((value) => parseFloat(value.trim()))
        if (parts.length !== 6) return null
        const [a, b, c, d, e, f] = parts
        return { a, b, c, d, e, f }
      }

      function nextFrame() {
        return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }

      const lightbox = document.querySelector(
        '[data-testid="image-lightbox"]',
      ) as HTMLElement | null
      const innerImg = document.querySelector(
        '[data-testid="lightbox-image"]',
      ) as HTMLImageElement | null
      if (!lightbox || !innerImg) {
        return { ok: false as const, reason: 'lightbox or inner img not found' }
      }

      const rect = lightbox.getBoundingClientRect()
      const startX = rect.left + rect.width * 0.7
      const midY = rect.top + rect.height * 0.5

      function fire(type: string, clientX: number, clientY: number) {
        const event = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerType: 'touch',
          pointerId: 1,
          clientX,
          clientY,
          isPrimary: true,
        })
        lightbox!.dispatchEvent(event)
      }

      const recorded: {
        phase: string
        img: ReturnType<typeof parseMatrix>
        wrapper: ReturnType<typeof parseMatrix>
      }[] = []

      const wrapper = innerImg.parentElement as HTMLElement | null
      if (!wrapper) {
        return { ok: false as const, reason: 'inner img has no parent wrapper' }
      }

      function snapshot(phase: string) {
        recorded.push({
          phase,
          img: parseMatrix(getComputedStyle(innerImg!).transform),
          wrapper: parseMatrix(getComputedStyle(wrapper!).transform),
        })
      }

      fire('pointerdown', startX, midY)
      await nextFrame()
      // Sample the wrapper's transform IMMEDIATELY after open — this
      // captures Framer's morph-in-flight projection so the test fails
      // loudly if a future regression moves the morph off the wrapper
      // (i.e., back onto the same DOM node as the swipe transform).
      snapshot('pointer-down')

      fire('pointermove', startX - 30, midY)
      await nextFrame()
      snapshot('move-30')

      fire('pointermove', startX - 80, midY)
      await nextFrame()
      snapshot('move-80')

      fire('pointermove', startX - 150, midY)
      await nextFrame()
      snapshot('move-150')

      // Release without committing — snap-back path.
      fire('pointermove', startX - 20, midY)
      fire('pointerup', startX - 20, midY)

      return { ok: true as const, recorded }
    })

    if (!samples.ok) throw new Error(`swipe instrumentation failed: ${samples.reason}`)

    // Each sample's inner-img matrix should reflect the swipe's translateX
    // with scale of 1.0 (no Framer scale interpolation contention).
    const pointerDown = samples.recorded.find((sample) => sample.phase === 'pointer-down')
    const move30 = samples.recorded.find((sample) => sample.phase === 'move-30')
    const move80 = samples.recorded.find((sample) => sample.phase === 'move-80')
    const move150 = samples.recorded.find((sample) => sample.phase === 'move-150')

    if (!pointerDown || !move30 || !move80 || !move150) {
      throw new Error('expected one pointer-down sample + three move samples')
    }
    if (!move30.img || !move80.img || !move150.img) {
      throw new Error(
        `inner img has no transform matrix during move samples — Framer-vs-React contest may have re-emerged`,
      )
    }

    // Regression-test core: at pointerdown (i.e., the moment swipe begins),
    // the wrapper MUST be carrying a non-identity Framer matrix — that is
    // proof the swipe is firing DURING the morph window. Without this
    // assertion, a future regression that puts the swipe transform back
    // onto the wrapper could pass the inner-img matrix checks below on
    // warm-cache runs where the morph has already settled.
    if (!pointerDown.wrapper) {
      throw new Error('wrapper has no transform matrix at pointerdown — morph not in flight')
    }
    const wrapperIsIdentity =
      Math.abs(pointerDown.wrapper.a - 1) < 0.001 &&
      Math.abs(pointerDown.wrapper.d - 1) < 0.001 &&
      Math.abs(pointerDown.wrapper.e) < 0.001 &&
      Math.abs(pointerDown.wrapper.f) < 0.001
    expect(
      wrapperIsIdentity,
      `expected wrapper to carry an in-flight Framer matrix at pointerdown (proof we are inside the morph window); got identity matrix instead — Framer morph is not on the wrapper or has already settled`,
    ).toBe(false)

    // translateX (matrix.e) tracks the move delta linearly. ±5 px slack
    // accounts for axis-lock distance threshold and rounding.
    expect(move30.img.e).toBeGreaterThanOrEqual(-35)
    expect(move30.img.e).toBeLessThanOrEqual(-25)
    expect(move80.img.e).toBeGreaterThanOrEqual(-85)
    expect(move80.img.e).toBeLessThanOrEqual(-75)
    expect(move150.img.e).toBeGreaterThanOrEqual(-155)
    expect(move150.img.e).toBeLessThanOrEqual(-145)

    // Scale (matrix.a, matrix.d) stays at 1.0 on the inner img — Framer's
    // scale interpolation lives on the parent <motion.div>, not here.
    for (const sample of [move30, move80, move150]) {
      expect(sample.img!.a).toBeGreaterThanOrEqual(0.99)
      expect(sample.img!.a).toBeLessThanOrEqual(1.01)
      expect(sample.img!.d).toBeGreaterThanOrEqual(0.99)
      expect(sample.img!.d).toBeLessThanOrEqual(1.01)
    }

    await touchContext.close()
  })
})
