import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(),
}))

import { cleanupStorageKeys } from '@/lib/storage-cleanup'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'

describe('cleanupStorageKeys', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  it('returns early without calling the adapter when keys array is empty', async () => {
    await cleanupStorageKeys([])
    expect(getImageStorageAdapter).not.toHaveBeenCalled()
  })

  it('calls deleteObject once per non-null key on the happy path', async () => {
    const deleteObject = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getImageStorageAdapter).mockReturnValue({
      deleteObject,
    } as unknown as ReturnType<typeof getImageStorageAdapter>)

    await cleanupStorageKeys([
      { storageKey: 'steps/abc/1.jpg' },
      { storageKey: 'steps/abc/2.jpg' },
      { storageKey: 'ideas/xyz/3.jpg' },
    ])

    expect(deleteObject).toHaveBeenCalledTimes(3)
    expect(deleteObject).toHaveBeenNthCalledWith(1, 'steps/abc/1.jpg')
    expect(deleteObject).toHaveBeenNthCalledWith(2, 'steps/abc/2.jpg')
    expect(deleteObject).toHaveBeenNthCalledWith(3, 'ideas/xyz/3.jpg')
  })

  it('skips null and undefined storage keys without calling deleteObject', async () => {
    const deleteObject = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getImageStorageAdapter).mockReturnValue({
      deleteObject,
    } as unknown as ReturnType<typeof getImageStorageAdapter>)

    await cleanupStorageKeys([
      { storageKey: 'steps/abc/1.jpg' },
      { storageKey: null },
      { storageKey: 'ideas/xyz/3.jpg' },
    ])

    expect(deleteObject).toHaveBeenCalledTimes(2)
    expect(deleteObject).toHaveBeenNthCalledWith(1, 'steps/abc/1.jpg')
    expect(deleteObject).toHaveBeenNthCalledWith(2, 'ideas/xyz/3.jpg')
  })

  it('continues the loop and logs when a single deleteObject call rejects', async () => {
    const deleteObject = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('S3 down'))
      .mockResolvedValueOnce(undefined)
    vi.mocked(getImageStorageAdapter).mockReturnValue({
      deleteObject,
    } as unknown as ReturnType<typeof getImageStorageAdapter>)

    await expect(
      cleanupStorageKeys([
        { storageKey: 'steps/abc/1.jpg' },
        { storageKey: 'steps/abc/2.jpg' },
        { storageKey: 'ideas/xyz/3.jpg' },
      ]),
    ).resolves.toBeUndefined()

    expect(deleteObject).toHaveBeenCalledTimes(3)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Storage cleanup failed:', expect.any(Error))
  })

  it('logs a single warning and skips deletion when the adapter is unavailable', async () => {
    vi.mocked(getImageStorageAdapter).mockReturnValue(null)

    await cleanupStorageKeys([{ storageKey: 'steps/abc/1.jpg' }, { storageKey: 'steps/abc/2.jpg' }])

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith('Storage cleanup skipped — adapter unavailable')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('does not throw when called with a list of all-null keys', async () => {
    const deleteObject = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getImageStorageAdapter).mockReturnValue({
      deleteObject,
    } as unknown as ReturnType<typeof getImageStorageAdapter>)

    await cleanupStorageKeys([{ storageKey: null }, { storageKey: null }])

    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('routes opts.mediaType to deleteObject per entry (Epic 35)', async () => {
    // Mixed-media cascade: a step with 2 IMAGE + 1 VIDEO rows triggers
    // 3 deleteObject calls; the VIDEO call MUST carry { mediaType: 'video' }
    // so the Cloudinary adapter passes resource_type:'video' (load-bearing
    // for FR122 / FR137 — without it, video bytes are orphaned).
    const deleteObject = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getImageStorageAdapter).mockReturnValue({
      deleteObject,
    } as unknown as ReturnType<typeof getImageStorageAdapter>)

    await cleanupStorageKeys([
      { storageKey: 'steps/abc/1.jpg', mediaType: 'image' },
      { storageKey: 'steps/abc/2.jpg', mediaType: 'image' },
      { storageKey: 'steps/abc/3.mp4', mediaType: 'video' },
    ])

    expect(deleteObject).toHaveBeenCalledTimes(3)
    expect(deleteObject).toHaveBeenCalledWith('steps/abc/1.jpg', { mediaType: 'image' })
    expect(deleteObject).toHaveBeenCalledWith('steps/abc/2.jpg', { mediaType: 'image' })
    expect(deleteObject).toHaveBeenCalledWith('steps/abc/3.mp4', { mediaType: 'video' })
  })

  it('preserves the pre-35.1 call shape when mediaType is absent (back-compat)', async () => {
    // Callers that haven't been widened (e.g., deleteIdea's idea_image
    // collection, which doesn't gain mediaType in V1) must continue to
    // call deleteObject(key) with NO opts arg — proves the optional
    // widening doesn't break the existing IMAGE-only contract.
    const deleteObject = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getImageStorageAdapter).mockReturnValue({
      deleteObject,
    } as unknown as ReturnType<typeof getImageStorageAdapter>)

    await cleanupStorageKeys([
      { storageKey: 'ideas/xyz/photo.jpg' },
      { storageKey: 'ideas/xyz/cover.jpg' },
    ])

    expect(deleteObject).toHaveBeenCalledTimes(2)
    // No second arg — the helper omits opts when mediaType is undefined.
    expect(deleteObject).toHaveBeenNthCalledWith(1, 'ideas/xyz/photo.jpg')
    expect(deleteObject).toHaveBeenNthCalledWith(2, 'ideas/xyz/cover.jpg')
  })

  it('handles mixed mediaType-present and mediaType-absent entries in one call (Epic 35)', async () => {
    // deleteHobby collapses step_image (has mediaType) and idea_image (no
    // mediaType) into one cleanup call. Both shapes must coexist.
    const deleteObject = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getImageStorageAdapter).mockReturnValue({
      deleteObject,
    } as unknown as ReturnType<typeof getImageStorageAdapter>)

    await cleanupStorageKeys([
      { storageKey: 'steps/abc/vid.mp4', mediaType: 'video' },
      { storageKey: 'ideas/xyz/photo.jpg' },
      { storageKey: 'steps/abc/img.jpg', mediaType: 'image' },
    ])

    expect(deleteObject).toHaveBeenCalledTimes(3)
    expect(deleteObject).toHaveBeenCalledWith('steps/abc/vid.mp4', { mediaType: 'video' })
    expect(deleteObject).toHaveBeenNthCalledWith(2, 'ideas/xyz/photo.jpg')
    expect(deleteObject).toHaveBeenCalledWith('steps/abc/img.jpg', { mediaType: 'image' })
  })
})
