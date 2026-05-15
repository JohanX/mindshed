import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  seedHobby,
  seedProject,
  seedStepImage,
  deleteHobbyCascade,
  type SeededHobby,
} from './helpers/db-seed'
import {
  putMinioObject,
  minioObjectExists,
  deleteMinioObject,
  syntheticMp4Buffer,
} from './helpers/minio'

/**
 * Story 35.4 / FR137 — cascade-cleanup E2E for VIDEO step_image rows on
 * MinIO (S3 mode).
 *
 * Proves the end-to-end cascade contract:
 *   1. A real MinIO object is PUT at a storage key
 *   2. A VIDEO `step_image` row points at that key
 *   3. The deletion server-action runs via the UI
 *   4. Story 35.1's `cleanupStorageKeys` routes `{ mediaType: 'video' }`
 *      through the adapter → MinIO HEAD returns 404
 *
 * Story 35.1 unit-tests the action → cleanupStorageKeys wiring; this
 * spec closes the contract end-to-end against an actual S3 backend.
 *
 * S3 mode is the only adapter exercised here — Cloudinary's
 * `destroy({ resource_type: 'video' })` is exercised by the adapter's
 * unit tests and is not callable from CI (no Cloudinary creds in
 * `.env.test`).
 */

// Webkit + Firefox add cost without changing the contract (the cascade
// is server-side; the UI just clicks Delete). Run in chromium only.
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'cascade-cleanup is server-side; chromium-only smoke is sufficient',
)

test.describe.configure({ mode: 'serial' })

async function navigateAndDeleteStep(
  page: import('@playwright/test').Page,
  opts: {
    hobbyId: string
    projectId: string
  },
) {
  await page.goto(`/hobbies/${opts.hobbyId}/projects/${opts.projectId}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Step actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  // ConfirmDialog renders a Delete button on the modal — disambiguate
  // from the menuitem we just dismissed by waiting for the dialog.
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
}

async function navigateAndDeleteProject(
  page: import('@playwright/test').Page,
  opts: {
    hobbyId: string
    projectId: string
  },
) {
  await page.goto(`/hobbies/${opts.hobbyId}/projects/${opts.projectId}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Project actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
}

test.describe('Storage cascade cleanup — VIDEO (Story 35.4 / FR137)', () => {
  test('deleteStep removes the MinIO object for an UPLOAD VIDEO step_image', async ({ page }) => {
    const hobby = await seedHobby({ name: `CascadeStep-${Date.now()}` })
    const seeded = await seedProject({
      hobbyId: hobby.id,
      name: `Cascade Step Project ${Date.now()}`,
      steps: [{ name: 'Cascade Step' }],
    })
    const storageKey = `steps/${seeded.steps[0].id}/${randomUUID()}.mp4`

    try {
      await putMinioObject({
        storageKey,
        body: syntheticMp4Buffer(),
        contentType: 'video/mp4',
      })
      await seedStepImage({
        stepId: seeded.steps[0].id,
        type: 'UPLOAD',
        mediaType: 'VIDEO',
        storageKey,
        contentType: 'video/mp4',
        sizeBytes: 8,
        durationSeconds: 10,
      })
      expect(await minioObjectExists(storageKey)).toBe(true)

      await navigateAndDeleteStep(page, { hobbyId: hobby.id, projectId: seeded.project.id })

      // cleanupStorageKeys runs post-commit; allow a brief settle window.
      // Story 35.4 code-review patch (Edge Hunter #4): cleanupStorageKeys
      // is fire-and-forget post-commit; 20s tolerates slow CI runners
      // and MinIO GC contention without masking a real regression.
      await expect.poll(() => minioObjectExists(storageKey), { timeout: 20_000 }).toBe(false)
    } finally {
      await deleteMinioObject(storageKey)
      await deleteHobbyCascade(hobby.id).catch(() => {})
    }
  })

  test('deleteProject removes the MinIO object for a child step VIDEO', async ({ page }) => {
    const hobby = await seedHobby({ name: `CascadeProject-${Date.now()}` })
    const seeded = await seedProject({
      hobbyId: hobby.id,
      name: `Cascade Project ${Date.now()}`,
      steps: [{ name: 'Cascade Step' }],
    })
    const storageKey = `steps/${seeded.steps[0].id}/${randomUUID()}.mp4`

    try {
      await putMinioObject({
        storageKey,
        body: syntheticMp4Buffer(),
        contentType: 'video/mp4',
      })
      await seedStepImage({
        stepId: seeded.steps[0].id,
        type: 'UPLOAD',
        mediaType: 'VIDEO',
        storageKey,
        contentType: 'video/mp4',
        sizeBytes: 8,
        durationSeconds: 10,
      })
      expect(await minioObjectExists(storageKey)).toBe(true)

      await navigateAndDeleteProject(page, {
        hobbyId: hobby.id,
        projectId: seeded.project.id,
      })

      // Story 35.4 code-review patch (Edge Hunter #4): cleanupStorageKeys
      // is fire-and-forget post-commit; 20s tolerates slow CI runners
      // and MinIO GC contention without masking a real regression.
      await expect.poll(() => minioObjectExists(storageKey), { timeout: 20_000 }).toBe(false)
    } finally {
      await deleteMinioObject(storageKey)
      await deleteHobbyCascade(hobby.id).catch(() => {})
    }
  })

  test('deleteHobby (via cascade-deleted projects) cleans VIDEO storage keys', async ({ page }) => {
    // The hobby-delete flow lives on the settings page; the delete
    // confirmation reaches deleteHobby() which calls cleanupStorageKeys
    // with `{ mediaType: 'video' }` for VIDEO rows under all projects.
    const hobbyName = `CascadeHobby-${Date.now()}`
    const hobby: SeededHobby = await seedHobby({ name: hobbyName })
    const seeded = await seedProject({
      hobbyId: hobby.id,
      name: `Cascade Hobby Project ${Date.now()}`,
      steps: [{ name: 'Cascade Step' }],
    })
    const storageKey = `steps/${seeded.steps[0].id}/${randomUUID()}.mp4`

    try {
      await putMinioObject({
        storageKey,
        body: syntheticMp4Buffer(),
        contentType: 'video/mp4',
      })
      await seedStepImage({
        stepId: seeded.steps[0].id,
        type: 'UPLOAD',
        mediaType: 'VIDEO',
        storageKey,
        contentType: 'video/mp4',
        sizeBytes: 8,
        durationSeconds: 10,
      })
      expect(await minioObjectExists(storageKey)).toBe(true)

      await page.goto('/settings')
      await page.waitForLoadState('networkidle')
      const hobbyRow = page
        .locator('div.relative')
        .filter({ has: page.getByRole('link', { name: new RegExp(hobbyName) }) })
      await hobbyRow.getByRole('button', { name: 'Hobby actions' }).click()
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()

      // Story 35.4 code-review patch (Edge Hunter #4): cleanupStorageKeys
      // is fire-and-forget post-commit; 20s tolerates slow CI runners
      // and MinIO GC contention without masking a real regression.
      await expect.poll(() => minioObjectExists(storageKey), { timeout: 20_000 }).toBe(false)
    } finally {
      await deleteMinioObject(storageKey)
      await deleteHobbyCascade(hobby.id).catch(() => {})
    }
  })
})
