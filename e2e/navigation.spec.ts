import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('mobile: bottom nav visible with 5 items', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible()
    await expect(page.getByText('Hobbies')).toBeVisible()
    await expect(page.locator('nav').getByText('Inventory')).toBeVisible()
    await expect(page.getByText('Settings').first()).toBeVisible()
  })

  test('desktop: top bar with MindShed branding', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    const header = page.locator('header')
    await expect(header).toBeVisible()
    await expect(header.getByRole('link', { name: 'MindShed' })).toBeVisible()
  })

  test('desktop: no sidebar (aside)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await expect(page.locator('aside')).toHaveCount(0)
  })

  test('navigation to hobbies page via mobile nav', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.locator('nav').getByText('Hobbies').click()
    await expect(page).toHaveURL('/hobbies')
  })

  test('navigation to ideas page', async ({ page }) => {
    await page.goto('/ideas')
    await expect(page).toHaveURL('/ideas')
    await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible()
  })

  test('navigation to inventory page', async ({ page }) => {
    await page.goto('/inventory')
    await expect(page).toHaveURL('/inventory')
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible()
  })

  test('desktop: inventory link visible in top bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Inventory' })).toBeVisible()
  })

  test('settings page accessible', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('breadcrumbs on hobbies page', async ({ page }) => {
    await page.goto('/hobbies')
    await expect(page.getByRole('heading', { name: 'Hobbies' })).toBeVisible()
    // Breadcrumb has Dashboard link
    await expect(page.getByLabel('breadcrumb').getByText('Dashboard')).toBeVisible()
  })

  // Issue #17 regression: an `AnimatePresence mode="wait"` wrapper around
  // the keyed route content could leave the freshly-mounted child
  // latched onto the exiting child's in-flight motion values under App
  // Router's RSC streaming — the new page mounted at `opacity: 0;
  // translateY(-8px)` and never advanced to `animate`, leaving the
  // route blank until a viewport resize forced a repaint. The fix
  // removes `AnimatePresence` so React reconciles the key change as
  // unmount → mount and the new wrapper always runs its own
  // initial → animate cycle, settling at opacity 1.
  //
  // `reducedMotion: 'no-preference'` is pinned because Framer collapses
  // transitions to instant under reduced motion, which would make the
  // assertion trivially green and miss a regression. In Playwright
  // 1.59 this option lives on `contextOptions`, not directly on
  // PlaywrightTestOptions.
  test.use({ contextOptions: { reducedMotion: 'no-preference' } })

  test('route transition wrapper is visible after repeated client-side navigations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const wrappers = page.getByTestId('route-transition')
    const header = page.locator('header')

    // Alternate Inventory ↔ Settings via the top-bar links six times.
    // Pre-fix, the second-or-later landing on a route would leave the
    // wrapper stuck at `opacity: 0; transform: translateY(-8px)`.
    const targets: Array<{
      name: 'Inventory' | 'Settings'
      url: string
      heading: string
    }> = [
      { name: 'Inventory', url: '/inventory', heading: 'Inventory' },
      { name: 'Settings', url: '/settings', heading: 'Settings' },
      { name: 'Inventory', url: '/inventory', heading: 'Inventory' },
      { name: 'Settings', url: '/settings', heading: 'Settings' },
      { name: 'Inventory', url: '/inventory', heading: 'Inventory' },
      { name: 'Settings', url: '/settings', heading: 'Settings' },
    ]

    for (const target of targets) {
      await header.getByRole('link', { name: target.name }).click()
      await expect(page).toHaveURL(target.url)

      // The wrapper's opacity must settle at ~1 (allow tiny float
      // imprecision) within the slide duration plus a generous CI
      // buffer. Pre-fix, this stayed at 0 indefinitely.
      // `.last()` picks the most recently mounted wrapper; bare keyed
      // motion.div should yield exactly one, but `.last()` is robust if
      // an animation library briefly retains an exiting node.
      await expect
        .poll(() => wrappers.last().evaluate((el) => parseFloat(getComputedStyle(el).opacity)), {
          timeout: 5000,
        })
        .toBeGreaterThanOrEqual(0.99)

      // Stronger user-facing assertion: the page heading is actually
      // visible. A wrapper at opacity 1 is necessary but not sufficient
      // proof the route rendered — this catches regressions where the
      // wrapper paints but children fail.
      await expect(page.getByRole('heading', { name: target.heading })).toBeVisible()
    }
  })
})
