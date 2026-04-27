import { describe, it, expect } from 'vitest'
import { addInventoryItemImageSchema, addInventoryItemImageLinkSchema } from '../inventory-image'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('addInventoryItemImageSchema', () => {
  const base = {
    inventoryItemId: VALID_UUID,
    storageKey: `inventory/${VALID_UUID}/${VALID_UUID}.jpg`,
    originalFilename: 'photo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 12345,
  }

  it('accepts valid input', () => {
    expect(addInventoryItemImageSchema.safeParse(base).success).toBe(true)
  })

  it('rejects non-uuid inventoryItemId', () => {
    expect(addInventoryItemImageSchema.safeParse({ ...base, inventoryItemId: 'bad' }).success).toBe(
      false,
    )
  })

  it('rejects storageKey with wrong prefix', () => {
    expect(
      addInventoryItemImageSchema.safeParse({ ...base, storageKey: 'steps/abc/def.jpg' }).success,
    ).toBe(false)
  })

  it('rejects unsupported contentType', () => {
    expect(
      addInventoryItemImageSchema.safeParse({ ...base, contentType: 'image/gif' }).success,
    ).toBe(false)
  })

  it('rejects negative sizeBytes', () => {
    expect(addInventoryItemImageSchema.safeParse({ ...base, sizeBytes: -1 }).success).toBe(false)
  })

  it('rejects sizeBytes over 10MB', () => {
    expect(addInventoryItemImageSchema.safeParse({ ...base, sizeBytes: 10_485_761 }).success).toBe(
      false,
    )
  })
})

describe('addInventoryItemImageLinkSchema', () => {
  it('accepts valid https URL', () => {
    const result = addInventoryItemImageLinkSchema.safeParse({
      inventoryItemId: VALID_UUID,
      url: 'https://example.com/photo.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid http URL', () => {
    const result = addInventoryItemImageLinkSchema.safeParse({
      inventoryItemId: VALID_UUID,
      url: 'http://example.com/photo.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('rejects ftp:// URL', () => {
    const result = addInventoryItemImageLinkSchema.safeParse({
      inventoryItemId: VALID_UUID,
      url: 'ftp://example.com/file',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid inventoryItemId', () => {
    const result = addInventoryItemImageLinkSchema.safeParse({
      inventoryItemId: 'bad',
      url: 'https://example.com/photo.jpg',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-URL string', () => {
    const result = addInventoryItemImageLinkSchema.safeParse({
      inventoryItemId: VALID_UUID,
      url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })
})
