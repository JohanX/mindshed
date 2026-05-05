import { test, expect } from '@playwright/test'

// Story 26.1 (revised) — verifies the shared Dialog primitives implement
// the scrollable-overlay pattern (shadcn-ui issue #16). The DialogOverlay
// is the scroll container (`overflow-y-auto`); DialogContent is a normal
// flex/grid child anchored at the top via `items-start` at every
// breakpoint. This sidesteps iOS Safari/Chrome's `position: fixed` +
// visual-viewport quirks when the soft keyboard is open AND keeps tall
// desktop dialogs (e.g. inventory edit with photos) from rendering with
// their close button above the viewport — the previous `sm:items-center`
// override caused that desktop flake (Story 31.4). Real keyboard
// interaction can't be reliably simulated by Playwright, so this test
// verifies the structural CSS contract — the physical mobile-with-
// keyboard verification is a manual smoke per Story 26.1's Task 5.
test.describe.configure({ mode: 'serial' })

test.describe('Dialog mobile viewport sizing (Story 26.1)', () => {
  test('DialogOverlay is the scroll container, anchored top at every viewport', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Open the Add Hobby dialog (any dialog will do — they all use the
    // shared DialogContent primitive).
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()

    const overlay = page.locator('[data-slot="dialog-overlay"]').first()
    const content = page.locator('[data-slot="dialog-content"]').first()
    await expect(content).toBeVisible({ timeout: 5000 })

    // Overlay carries scroll + alignment. items-start anchors the
    // dialog near the top at every breakpoint so the user can scroll
    // past the dialog even with the soft keyboard up (mobile) and tall
    // desktop dialogs don't push their close button above the viewport.
    const overlayClass = (await overlay.getAttribute('class')) ?? ''
    expect(overlayClass).toMatch(/overflow-y-auto/)
    expect(overlayClass).toMatch(/items-start/)
    expect(overlayClass).not.toMatch(/sm:items-center/)

    // Content is NOT fixed-positioned — it's a normal flow child of the
    // scrolling overlay. We assert that it's `relative` (so the close
    // button can absolute-position against it) and lacks the old
    // `fixed`/`translate-y` positioning that fought iOS layout viewport.
    const contentClass = (await content.getAttribute('class')) ?? ''
    expect(contentClass).toMatch(/relative/)
    expect(contentClass).not.toMatch(/\bfixed\b/)

    // Computed style sanity check: overlay scrolls vertically; content
    // sizes intrinsically (no max-height capped to layout vh).
    const overlayOverflowY = await overlay.evaluate((el) => window.getComputedStyle(el).overflowY)
    expect(overlayOverflowY).toBe('auto')
  })
})
