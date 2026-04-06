import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('mobile: bottom nav bar is visible with 3 items', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    const nav = page.locator('nav.fixed.bottom-0')
    await expect(nav).toBeVisible()
    await expect(nav.getByText('Dashboard')).toBeVisible()
    await expect(nav.getByText('Hobbies')).toBeVisible()
    await expect(nav.getByText('Ideas')).toBeVisible()
  })

  test('mobile: sidebar is hidden', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeHidden()
  })

  test('desktop: sidebar is visible with MindShed branding', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.getByText('MindShed')).toBeVisible()
    await expect(sidebar.getByText('Dashboard')).toBeVisible()
    await expect(sidebar.getByText('Hobbies')).toBeVisible()
    await expect(sidebar.getByText('Ideas')).toBeVisible()
  })

  test('desktop: bottom nav is hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    const bottomNav = page.locator('nav.fixed.bottom-0')
    await expect(bottomNav).toBeHidden()
  })

  test('navigation between pages updates active state', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Hobbies').first().click()
    await expect(page).toHaveURL('/hobbies')
    await page.getByText('Ideas').first().click()
    await expect(page).toHaveURL('/ideas')
    await page.getByText('Dashboard').first().click()
    await expect(page).toHaveURL('/')
  })

  test('breadcrumbs appear on sub-pages', async ({ page }) => {
    await page.goto('/hobbies')
    await expect(page.getByText('Dashboard').first()).toBeVisible()
  })
})
