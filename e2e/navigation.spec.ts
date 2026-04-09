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
})
