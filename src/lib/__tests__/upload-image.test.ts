import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/actions/image', () => ({
  addStepImage: vi.fn().mockResolvedValue({ success: true, data: { id: 'img1' } }),
  uploadImageCloudinary: vi.fn().mockResolvedValue({ success: true, data: { id: 'img2' } }),
}))

import { uploadImageToStorage } from '@/lib/upload-image'

function makeFile(name: string, type: string, size: number): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

describe('uploadImageToStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    delete process.env.NEXT_PUBLIC_IMAGE_PROVIDER
  })

  it('rejects files over 10MB', async () => {
    const file = makeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024)
    const result = await uploadImageToStorage({ stepId: 's1', file })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('10 MB')
  })

  it('rejects invalid content types', async () => {
    const file = makeFile('doc.pdf', 'application/pdf', 1000)
    const result = await uploadImageToStorage({ stepId: 's1', file })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('JPEG')
  })

  it('returns success on successful S3 upload', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    const result = await uploadImageToStorage({ stepId: 's1', file })
    expect(result.success).toBe(true)
  })

  it('returns error on presign failure', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }))

    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    const result = await uploadImageToStorage({ stepId: 's1', file })
    expect(result.success).toBe(false)
  })

  it('returns error on PUT failure', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))

    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    const result = await uploadImageToStorage({ stepId: 's1', file })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('storage failed')
  })

  it('skips presign call when NEXT_PUBLIC_IMAGE_PROVIDER=cloudinary', async () => {
    process.env.NEXT_PUBLIC_IMAGE_PROVIDER = 'cloudinary'
    const mockFetch = vi.mocked(global.fetch)

    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    const result = await uploadImageToStorage({ stepId: 's1', file })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    if (result.success) expect(result.key).toBe('cloudinary')
  })
})
