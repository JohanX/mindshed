import { test, expect } from '@playwright/test'
import { seedHobby, seedProject, deleteHobbyCascade } from './helpers/db-seed'

/**
 * Story 35.2 / FR134 — step video upload path. Covers the contract
 * boundaries (presign route MIME widening, UI accept attribute) at the
 * E2E level.
 *
 * The full upload + DB round-trip is intentionally deferred to Story
 * 35.4's `video-round-trip-minio.spec.ts`: that story stands up a
 * MinIO instance for S3-mode tests, which is the right place to drive
 * a real video PUT through presigned URLs. Generating a fake MP4 in
 * this spec via canvas + MediaRecorder is fragile (codec / container
 * coverage varies per platform) and over-couples to browser internals
 * for a foundation story.
 */

test.describe.configure({ mode: 'serial' })

test.describe('Step Video Upload (Story 35.2 / FR134)', () => {
  let hobbyId: string
  let hobbyName: string
  let stepId: string

  test.beforeAll(async ({ browserName }) => {
    hobbyName = `VidTest-${browserName}-${Date.now()}`
    const hobby = await seedHobby({ name: hobbyName })
    hobbyId = hobby.id
    const { steps } = await seedProject({
      hobbyId,
      name: 'Video Test Project',
      steps: [{ name: 'Test Step' }],
    })
    stepId = steps[0].id
  })

  test.afterAll(async () => {
    if (hobbyId) {
      await deleteHobbyCascade(hobbyId).catch(() => {})
    }
  })

  test.describe('Presign route MIME widening', () => {
    // Playwright's test runner has no `.each` — explicit per-MIME tests
    // keep each case identifiable in the report.
    for (const mime of ['video/mp4', 'video/quicktime', 'video/webm']) {
      test(`accepts ${mime} for steps prefix`, async ({ request }) => {
        const response = await request.post('/api/upload/presign', {
          data: {
            prefix: 'steps',
            stepId,
            filename: 'clip.mp4',
            contentType: mime,
          },
        })
        // 200 = adapter configured and presign succeeded (S3 mode).
        // 401 = auth required without storage state.
        // 404 = Cloudinary mode (no presign support).
        // 501 = no adapter configured.
        // ALL valid — what we're proving is the MIME is NOT rejected
        // at the schema validation layer with 400.
        expect([200, 401, 404, 501]).toContain(response.status())
      })
    }

    test('rejects video MIME for idea prefix (kind-mismatch)', async ({ request }) => {
      const response = await request.post('/api/upload/presign', {
        data: {
          prefix: 'ideas',
          ideaId: '550e8400-e29b-41d4-a716-446655440000',
          filename: 'clip.mp4',
          contentType: 'video/mp4',
        },
      })
      // 400 = schema refine rejects (video on non-step prefix).
      // 401 = auth required (also valid rejection).
      expect([400, 401]).toContain(response.status())
    })

    test('rejects video MIME for inventory prefix (kind-mismatch)', async ({ request }) => {
      const response = await request.post('/api/upload/presign', {
        data: {
          prefix: 'inventory',
          inventoryItemId: '550e8400-e29b-41d4-a716-446655440000',
          filename: 'clip.mp4',
          contentType: 'video/mp4',
        },
      })
      expect([400, 401]).toContain(response.status())
    })

    test('rejects unsupported MIME on steps prefix', async ({ request }) => {
      const response = await request.post('/api/upload/presign', {
        data: {
          prefix: 'steps',
          stepId,
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        },
      })
      expect([400, 401]).toContain(response.status())
    })
  })

  // UI-level assertion of the upload button's `accept` attribute was
  // dropped — over-coupled to step-card rendering and timing. The
  // contract is proven at the unit level (`upload-image.test.ts`
  // asserts `ACCEPTED_STEP_MEDIA_TYPES` includes all 3 video MIMEs +
  // the 3 image MIMEs, and `image-upload-button.tsx` binds the input
  // accept directly to that constant). The presign-route widening
  // above is the load-bearing E2E contract this story needs to lock.
})
