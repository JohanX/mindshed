export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number]

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
