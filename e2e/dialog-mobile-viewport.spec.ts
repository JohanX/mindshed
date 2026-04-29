import { test, expect } from '@playwright/test'

// Story 26.1 — verifies the shared DialogContent primitive uses `dvh`
// (dynamic viewport height) for its max-height. `dvh` correctly subtracts
// the soft keyboard region on iOS Chrome / Safari; `vh` does not. Real
// keyboard interaction can't be reliably simulated by Playwright, so this
// test verifies the CSS contract (the computed style contains `dvh`) — the
// physical mobile-with-keyboard verification is a manual smoke per the
// story's Task 5.
test.describe.configure({ mode: 'serial' })

test.describe('Dialog mobile viewport sizing (Story 26.1)', () => {
  test('DialogContent uses dvh-based max-height on mobile viewport', async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Open the Add Hobby dialog (any dialog will do — they all use the
    // shared DialogContent primitive).
    await page.locator('main').getByRole('button', { name: 'Add Hobby' }).first().click()

    const dialog = page.locator('[data-slot="dialog-content"]').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Verify the inline className OR the computed maxHeight references dvh.
    // `getComputedStyle` resolves `90dvh` to a pixel value at observation
    // time, so we check the rendered style attribute / Tailwind class
    // string directly (which preserves the `dvh` literal).
    const classAttr = (await dialog.getAttribute('class')) ?? ''
    expect(classAttr).toMatch(/max-h-\[90dvh\]/)

    // Computed max-height should resolve to a positive pixel value below
    // the layout viewport (812 × 0.9 = 730.8). This sanity-checks the
    // Tailwind arbitrary-value made it to CSS.
    const computedMaxHeight = await dialog.evaluate((el) => window.getComputedStyle(el).maxHeight)
    const px = parseFloat(computedMaxHeight)
    expect(px).toBeGreaterThan(0)
    expect(px).toBeLessThanOrEqual(812 * 0.9 + 1) // small tolerance for rounding
  })
})
