import {
  addInventoryItemImage,
  uploadInventoryItemImageCloudinary,
} from '@/actions/inventory-image'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'

export async function uploadInventoryImageToStorage(params: {
  inventoryItemId: string
  file: File
}): Promise<{ success: true; key: string } | { success: false; error: string }> {
  const { inventoryItemId, file } = params

  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { success: false, error: 'Only JPEG, PNG, and WebP images are allowed.' }
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { success: false, error: 'Image must be under 10 MB.' }
  }

  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER

  if (provider === 'cloudinary') {
    return uploadViaCloudinary(inventoryItemId, file)
  }

  try {
    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix: 'inventory',
        inventoryItemId,
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

      const result = await addInventoryItemImage({
        inventoryItemId,
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

  return uploadViaCloudinary(inventoryItemId, file)
}

async function uploadViaCloudinary(
  inventoryItemId: string,
  file: File,
): Promise<{ success: true; key: string } | { success: false; error: string }> {
  try {
    const formData = new FormData()
    formData.append('inventoryItemId', inventoryItemId)
    formData.append('file', file)
    const result = await uploadInventoryItemImageCloudinary(formData)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, key: 'cloudinary' }
  } catch {
    return { success: false, error: 'Upload failed — try again' }
  }
}
