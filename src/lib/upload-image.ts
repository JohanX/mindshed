import { addStepImage, uploadImageCloudinary } from '@/actions/image'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export { ACCEPTED_TYPES, MAX_SIZE_BYTES }

export async function uploadImageToStorage(params: {
  stepId: string
  file: File
}): Promise<{ success: true; key: string } | { success: false; error: string }> {
  const { stepId, file } = params

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { success: false, error: 'Only JPEG, PNG, and WebP images are allowed.' }
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { success: false, error: 'Image must be under 10 MB.' }
  }

  // Try S3/R2 presigned upload first
  try {
    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepId,
        filename: file.name,
        contentType: file.type,
      }),
    })

    if (presignRes.ok) {
      const { url, key } = (await presignRes.json()) as { url: string; key: string }
      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) {
        return { success: false, error: 'Upload to storage failed' }
      }

      const result = await addStepImage({
        stepId,
        storageKey: key,
        originalFilename: file.name,
        contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        sizeBytes: file.size,
      })
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true, key }
    }

    // 404/501 = not S3 mode, fall through to Cloudinary
    if (presignRes.status !== 404 && presignRes.status !== 501) {
      return { success: false, error: 'Failed to get upload URL' }
    }
  } catch {
    return { success: false, error: 'Upload failed — try again' }
  }

  // Fallback: Cloudinary
  try {
    const formData = new FormData()
    formData.append('stepId', stepId)
    formData.append('file', file)
    const result = await uploadImageCloudinary(formData)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, key: 'cloudinary' }
  } catch {
    return { success: false, error: 'Upload failed — try again' }
  }
}
