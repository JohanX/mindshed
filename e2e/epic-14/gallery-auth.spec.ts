import { test, expect } from '@playwright/test'

test.describe('Gallery Authentication Bypass', () => {
  // Use a fresh context without the auth cookie
  test.use({ storageState: { cookies: [], origins: [] } })

  test('/gallery is accessible without auth token', async ({ request }) => {
    const response = await request.get('/gallery')
    // Should NOT be 401 — gallery routes bypass auth
    expect(response.status()).not.toBe(401)
  })

  test('/ requires auth (returns 401 without token)', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(401)
  })
})
