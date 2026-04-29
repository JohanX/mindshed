import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StagedPhotoInput } from '@/components/image/staged-photo-input'

function makeFile(name: string, type: string, size: number): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

beforeEach(() => {
  // jsdom doesn't implement URL.createObjectURL — stub.
  global.URL.createObjectURL = vi.fn(() => 'blob:fake-url')
  global.URL.revokeObjectURL = vi.fn()
})

describe('StagedPhotoInput', () => {
  it('renders Upload + Camera buttons when no file is staged', () => {
    render(<StagedPhotoInput stagedFile={null} onStage={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /camera/i })).toBeInTheDocument()
    // Upload controls visible — preview should NOT be present.
    expect(screen.queryByTestId('staged-photo-preview')).not.toBeInTheDocument()
  })

  it('renders preview + Remove button when a file is staged', () => {
    const file = makeFile('photo.jpg', 'image/jpeg', 1000)
    render(<StagedPhotoInput stagedFile={file} onStage={vi.fn()} onClear={vi.fn()} />)
    // Preview shown — upload controls hidden.
    expect(screen.getByTestId('staged-photo-preview')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^upload$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^camera$/i })).not.toBeInTheDocument()
  })

  it('rejects files over 10MB with inline error', () => {
    const onStage = vi.fn()
    render(<StagedPhotoInput stagedFile={null} onStage={onStage} onClear={vi.fn()} />)
    const tooBig = makeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024)
    const fileInput = screen.getByTestId('staged-photo-file-input') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [tooBig] } })
    expect(onStage).not.toHaveBeenCalled()
    expect(screen.getByText(/under 10 MB/i)).toBeInTheDocument()
  })

  it('rejects unsupported content types with inline error', () => {
    const onStage = vi.fn()
    render(<StagedPhotoInput stagedFile={null} onStage={onStage} onClear={vi.fn()} />)
    const pdf = makeFile('doc.pdf', 'application/pdf', 1000)
    const fileInput = screen.getByTestId('staged-photo-file-input') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [pdf] } })
    expect(onStage).not.toHaveBeenCalled()
    expect(screen.getByText(/JPEG/i)).toBeInTheDocument()
  })

  it('calls onStage with valid JPEG file', () => {
    const onStage = vi.fn()
    render(<StagedPhotoInput stagedFile={null} onStage={onStage} onClear={vi.fn()} />)
    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    const fileInput = screen.getByTestId('staged-photo-file-input') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })
    expect(onStage).toHaveBeenCalledTimes(1)
    expect(onStage).toHaveBeenCalledWith(file)
  })

  it('calls onClear when Remove is clicked', () => {
    const onClear = vi.fn()
    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    render(<StagedPhotoInput stagedFile={file} onStage={vi.fn()} onClear={onClear} />)
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons when disabled prop is true', () => {
    render(<StagedPhotoInput stagedFile={null} onStage={vi.fn()} onClear={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /camera/i })).toBeDisabled()
  })
})
