import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImageFormInputs } from '@/components/image/image-form-inputs'

vi.mock('@/lib/upload-image', () => ({
  uploadImage: vi.fn(async () => ({ success: true, key: 'fake-key' })),
}))
vi.mock('@/actions/inventory-image', () => ({
  addInventoryItemImageLink: vi.fn(async () => ({ success: true, data: {} })),
}))
vi.mock('@/actions/idea-image', () => ({
  addIdeaImageLink: vi.fn(async () => ({ success: true, data: {} })),
}))
vi.mock('@/lib/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}))

import { uploadImage } from '@/lib/upload-image'
import { addInventoryItemImageLink } from '@/actions/inventory-image'
import { addIdeaImageLink } from '@/actions/idea-image'

function makeFile(name: string, type: string, size: number): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom doesn't implement URL.createObjectURL — stub.
  global.URL.createObjectURL = vi.fn(() => 'blob:fake-url')
  global.URL.revokeObjectURL = vi.fn()
})

describe('ImageFormInputs — staged mode', () => {
  it('renders Upload + Paste/Link controls when nothing is staged', () => {
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={null}
        stagedUrl={null}
        onStageFile={vi.fn()}
        onStageUrl={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument()
    expect(screen.getByTestId('image-form-inputs-link-prompt')).toBeInTheDocument()
    expect(screen.queryByTestId('image-form-inputs-preview')).not.toBeInTheDocument()
  })

  it('does NOT render a Camera or Take Photo button', () => {
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={null}
        stagedUrl={null}
        onStageFile={vi.fn()}
        onStageUrl={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /camera/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /take photo/i })).not.toBeInTheDocument()
  })

  it('renders preview + Remove when a file is staged', () => {
    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={file}
        stagedUrl={null}
        onStageFile={vi.fn()}
        onStageUrl={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByTestId('image-form-inputs-preview')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove staged photo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^upload$/i })).not.toBeInTheDocument()
  })

  it('renders preview + Remove when a URL is staged', () => {
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={null}
        stagedUrl="https://example.com/photo.jpg"
        onStageFile={vi.fn()}
        onStageUrl={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByTestId('image-form-inputs-preview')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove staged photo/i })).toBeInTheDocument()
  })

  it('calls onStageFile with a valid JPEG file', () => {
    const onStageFile = vi.fn()
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={null}
        stagedUrl={null}
        onStageFile={onStageFile}
        onStageUrl={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    const fileInput = screen.getByTestId('image-form-inputs-file') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })
    expect(onStageFile).toHaveBeenCalledTimes(1)
    expect(onStageFile).toHaveBeenCalledWith(file)
  })

  it('rejects files over 10MB with inline error and does NOT stage', () => {
    const onStageFile = vi.fn()
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={null}
        stagedUrl={null}
        onStageFile={onStageFile}
        onStageUrl={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    const tooBig = makeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024)
    const fileInput = screen.getByTestId('image-form-inputs-file') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [tooBig] } })
    expect(onStageFile).not.toHaveBeenCalled()
    expect(screen.getByText(/under 10 MB/i)).toBeInTheDocument()
  })

  it('rejects unsupported content types with inline error and does NOT stage', () => {
    const onStageFile = vi.fn()
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={null}
        stagedUrl={null}
        onStageFile={onStageFile}
        onStageUrl={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    const pdf = makeFile('doc.pdf', 'application/pdf', 1000)
    const fileInput = screen.getByTestId('image-form-inputs-file') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [pdf] } })
    expect(onStageFile).not.toHaveBeenCalled()
    expect(screen.getByText(/JPEG/i)).toBeInTheDocument()
  })

  it('calls onStageUrl after expanding link input and submitting a valid URL', async () => {
    const onStageUrl = vi.fn()
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={null}
        stagedUrl={null}
        onStageFile={vi.fn()}
        onStageUrl={onStageUrl}
        onClear={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('image-form-inputs-link-prompt'))
    const linkInput = screen.getByTestId('image-form-inputs-link-input') as HTMLInputElement
    fireEvent.change(linkInput, { target: { value: 'https://example.com/photo.jpg' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(onStageUrl).toHaveBeenCalledTimes(1)
    })
    expect(onStageUrl).toHaveBeenCalledWith('https://example.com/photo.jpg')
  })

  it('rejects malformed URL via inline error and does NOT stage', async () => {
    const onStageUrl = vi.fn()
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={null}
        stagedUrl={null}
        onStageFile={vi.fn()}
        onStageUrl={onStageUrl}
        onClear={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('image-form-inputs-link-prompt'))
    const linkInput = screen.getByTestId('image-form-inputs-link-input') as HTMLInputElement
    fireEvent.change(linkInput, { target: { value: 'not-a-url' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(onStageUrl).not.toHaveBeenCalled()
    })
    // An inline error message is rendered (the exact zod copy can drift, so
    // assert by aria-invalid on the input — that's the contract we own).
    expect(linkInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('calls onClear when Remove is clicked on a staged file', () => {
    const onClear = vi.fn()
    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    render(
      <ImageFormInputs
        mode="staged"
        entityKind="inventory"
        stagedFile={file}
        stagedUrl={null}
        onStageFile={vi.fn()}
        onStageUrl={vi.fn()}
        onClear={onClear}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remove staged photo/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('ImageFormInputs — live mode (inventory)', () => {
  it('calls uploadImage with kind=inventory and entityId on file pick', async () => {
    const onChange = vi.fn()
    render(
      <ImageFormInputs
        mode="live"
        entityKind="inventory"
        entityId="550e8400-e29b-41d4-a716-446655440000"
        onChange={onChange}
      />,
    )
    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    const fileInput = screen.getByTestId('image-form-inputs-file') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalledTimes(1)
    })
    expect(uploadImage).toHaveBeenCalledWith({
      kind: 'inventory',
      parentId: '550e8400-e29b-41d4-a716-446655440000',
      file,
    })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  it('calls addInventoryItemImageLink on URL save', async () => {
    const onChange = vi.fn()
    render(
      <ImageFormInputs
        mode="live"
        entityKind="inventory"
        entityId="550e8400-e29b-41d4-a716-446655440000"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('image-form-inputs-link-prompt'))
    const linkInput = screen.getByTestId('image-form-inputs-link-input') as HTMLInputElement
    fireEvent.change(linkInput, { target: { value: 'https://example.com/photo.jpg' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(addInventoryItemImageLink).toHaveBeenCalledTimes(1)
    })
    expect(addInventoryItemImageLink).toHaveBeenCalledWith({
      inventoryItemId: '550e8400-e29b-41d4-a716-446655440000',
      url: 'https://example.com/photo.jpg',
    })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })
})

describe('ImageFormInputs — live mode (idea)', () => {
  it('calls uploadImage with kind=idea on file pick', async () => {
    const onChange = vi.fn()
    render(
      <ImageFormInputs
        mode="live"
        entityKind="idea"
        entityId="123e4567-e89b-42d3-a456-426614174000"
        onChange={onChange}
      />,
    )
    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    const fileInput = screen.getByTestId('image-form-inputs-file') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalledWith({
        kind: 'idea',
        parentId: '123e4567-e89b-42d3-a456-426614174000',
        file,
      })
    })
  })

  it('calls addIdeaImageLink on URL save', async () => {
    const onChange = vi.fn()
    render(
      <ImageFormInputs
        mode="live"
        entityKind="idea"
        entityId="123e4567-e89b-42d3-a456-426614174000"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('image-form-inputs-link-prompt'))
    const linkInput = screen.getByTestId('image-form-inputs-link-input') as HTMLInputElement
    fireEvent.change(linkInput, { target: { value: 'https://example.com/photo.jpg' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(addIdeaImageLink).toHaveBeenCalledWith({
        ideaId: '123e4567-e89b-42d3-a456-426614174000',
        url: 'https://example.com/photo.jpg',
      })
    })
  })
})
