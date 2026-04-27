import { addIdeaImage, uploadIdeaImageCloudinary } from '@/actions/idea-image'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'

export async function uploadIdeaImageToStorage(params: {
  ideaId: string
  file: File
}): Promise<{ success: true; key: string } | { success: false; error: string }> {
  const { ideaId, file } = params

  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { success: false, error: 'Only JPEG, PNG, and WebP images are allowed.' }
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { success: false, error: 'Image must be under 10 MB.' }
  }

  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER

  if (provider === 'cloudinary') {
    return uploadViaCloudinary(ideaId, file)
  }

  try {
    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix: 'ideas',
        ideaId,
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

      const result = await addIdeaImage({
        ideaId,
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

    if (presignRes.status !== 404 && presignRes.status !== 501) {
      return { success: false, error: 'Failed to get upload URL' }
    }
  } catch {
    return { success: false, error: 'Upload failed — try again' }
  }

  return uploadViaCloudinary(ideaId, file)
}

async function uploadViaCloudinary(
  ideaId: string,
  file: File,
): Promise<{ success: true; key: string } | { success: false; error: string }> {
  try {
    const formData = new FormData()
    formData.append('ideaId', ideaId)
    formData.append('file', file)
    const result = await uploadIdeaImageCloudinary(formData)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, key: 'cloudinary' }
  } catch {
    return { success: false, error: 'Upload failed — try again' }
  }
}
