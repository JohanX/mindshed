export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number]

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

// Story 35.2 / FR134 — step images can also be videos. Idea + inventory
// images remain IMAGE-only in V1; the per-kind allow-lists in
// `upload-image.ts` and the presign-route schema enforce that asymmetry.
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const

export type AcceptedVideoType = (typeof ACCEPTED_VIDEO_TYPES)[number]

export const MAX_VIDEO_SIZE_BYTES = 60 * 1024 * 1024 // 60 MB
export const MAX_VIDEO_DURATION_SECONDS = 60

/** Combined image + video MIMEs accepted on step uploads. */
export const ACCEPTED_STEP_MEDIA_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES] as const

export type AcceptedStepMediaType = (typeof ACCEPTED_STEP_MEDIA_TYPES)[number]
