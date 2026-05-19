import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardContinueCard } from '../dashboard/dashboard-continue-card'
import type { RecentProject } from '@/lib/schemas/dashboard'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// Mock image storage adapter so resolveProjectThumbnailUrl returns a known URL.
// Story 35.6: extend the mock with `getVideoPosterUrl` so the VIDEO branch
// can resolve to a known poster URL (Cloudinary `so_auto` shape).
let videoPosterReturns: string | null = 'https://cdn.example.com/poster/key.jpg'
vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: () => ({
    getPublicUrl: (key: string) => `https://r2.example.com/bucket/${key}`,
    getThumbnailUrl: (key: string, width: number) =>
      `https://r2.example.com/bucket/${key}?w=${width}`,
    getVideoPosterUrl: () => videoPosterReturns,
    getVideoUrl: (key: string) => `https://r2.example.com/bucket/video/${key}`,
  }),
  isImageProviderSelfOptimized: () => true,
}))

const baseProject: RecentProject = {
  id: 'proj-1',
  name: 'Walnut Side Table',
  lastActivityAt: new Date('2026-03-15'),
  hobbyId: 'hobby-1',
  hobby: {
    id: 'hobby-1',
    name: 'Woodworking',
    color: 'hsl(25, 45%, 40%)',
    icon: null,
  },
  currentStep: {
    id: 'step-1',
    name: 'Apply danish oil',
  },
  latestPhoto: {
    storageKey: 'images/photo-1.jpg',
    originalFilename: 'photo.jpg',
    // Story 35.6 / FR139 — widened LatestProjectPhoto shape.
    mediaType: 'IMAGE',
    type: 'UPLOAD',
    url: null,
  },
  totalSteps: 5,
  completedSteps: 2,
  derivedStatus: 'IN_PROGRESS',
  totalHoursLogged: null,
}

describe('DashboardContinueCard', () => {
  it('renders project name', () => {
    render(<DashboardContinueCard project={baseProject} />)
    expect(screen.getByText('Walnut Side Table')).toBeInTheDocument()
  })

  it('renders hobby badge', () => {
    render(<DashboardContinueCard project={baseProject} />)
    expect(screen.getByText('Woodworking')).toBeInTheDocument()
  })

  it('renders current step name', () => {
    render(<DashboardContinueCard project={baseProject} />)
    expect(screen.getByText('Apply danish oil')).toBeInTheDocument()
  })

  it('renders photo thumbnail when latestPhoto exists', () => {
    render(<DashboardContinueCard project={baseProject} />)
    // Story 35.6 code-review MED-2: alt is decorative ('') because the
    // wrapping <Link> already announces the project name. Locate via
    // querySelector instead of alt-text.
    const img = document.querySelector('img') as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe('https://r2.example.com/bucket/images/photo-1.jpg?w=128')
    expect(img!.getAttribute('alt')).toBe('')
    // Story 35.6 code-review MED-3: lazy-load defers off-screen fetches
    // on multi-project list surfaces.
    expect(img!.getAttribute('loading')).toBe('lazy')
  })

  it('does not render photo when latestPhoto is null', () => {
    const noPhoto = { ...baseProject, latestPhoto: null }
    render(<DashboardContinueCard project={noPhoto} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('links to correct project URL', () => {
    const { container } = render(<DashboardContinueCard project={baseProject} />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/hobbies/hobby-1/projects/proj-1')
  })

  it('renders without current step when null', () => {
    const noStep = { ...baseProject, currentStep: null }
    render(<DashboardContinueCard project={noStep} />)
    expect(screen.getByText('Walnut Side Table')).toBeInTheDocument()
    expect(screen.queryByText('Apply danish oil')).not.toBeInTheDocument()
  })

  it('has min 44px touch target', () => {
    const { container } = render(<DashboardContinueCard project={baseProject} />)
    const link = container.querySelector('a')
    expect(link?.className).toContain('min-h-[44px]')
  })

  // Story 35.6 / FR139 — VIDEO branch coverage. The dashboard recent-projects
  // card must show a Play overlay (Cloudinary) or generic play-icon card (S3
  // null-poster) — never a broken `<img>` for a VIDEO public_id.
  describe('Story 35.6 — VIDEO latest-photo branches', () => {
    it('renders poster + Play overlay for VIDEO with non-null poster URL (Cloudinary)', () => {
      videoPosterReturns = 'https://cdn.example.com/poster/key.jpg'
      const videoProject: RecentProject = {
        ...baseProject,
        latestPhoto: {
          storageKey: 'steps/abc/video-xyz',
          originalFilename: 'clip.mp4',
          mediaType: 'VIDEO',
          type: 'UPLOAD',
          url: null,
        },
      }
      render(<DashboardContinueCard project={videoProject} />)
      // Poster <img> exists inside the VIDEO branch; located via the
      // testid wrapper since alt is decorative.
      const posterWrapper = screen.getByTestId('project-card-video-poster')
      const poster = posterWrapper.querySelector('img') as HTMLImageElement
      expect(poster).not.toBeNull()
      expect(poster.getAttribute('src')).toBe('https://cdn.example.com/poster/key.jpg')
      expect(poster.getAttribute('loading')).toBe('lazy')
      // Play overlay testid is present (visual affordance parity with
      // dashboard-galleries-section.tsx + step image grid).
      expect(screen.getByTestId('video-play-overlay')).toBeInTheDocument()
      // No null-poster placeholder when the Cloudinary URL is available.
      expect(screen.queryByTestId('project-card-video-placeholder')).not.toBeInTheDocument()
    })

    it('renders generic play-icon card for VIDEO with null poster URL (S3 mode)', () => {
      videoPosterReturns = null
      const videoProjectS3: RecentProject = {
        ...baseProject,
        latestPhoto: {
          storageKey: 'steps/abc/video-xyz',
          originalFilename: 'clip.mp4',
          mediaType: 'VIDEO',
          type: 'UPLOAD',
          url: null,
        },
      }
      render(<DashboardContinueCard project={videoProjectS3} />)
      expect(screen.getByTestId('project-card-video-placeholder')).toBeInTheDocument()
      // No broken `<img>` element AT ALL — the user must never see a
      // broken-image icon (this is the 2026-05-15 prod incident we're
      // closing).
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('IMAGE row continues to render the existing thumbnail path (regression)', () => {
      // baseProject already has mediaType: 'IMAGE' — re-render and assert
      // the existing IMAGE rendering is preserved exactly.
      render(<DashboardContinueCard project={baseProject} />)
      const img = document.querySelector('img') as HTMLImageElement | null
      expect(img).not.toBeNull()
      // The Play overlay testid does NOT appear for IMAGE rows.
      expect(screen.queryByTestId('video-play-overlay')).not.toBeInTheDocument()
      expect(screen.queryByTestId('project-card-video-placeholder')).not.toBeInTheDocument()
    })

    // Code-review HIGH-1: a project with NO photos at all surfaces as
    // `latestPhoto: { url: null, mediaType: 'IMAGE' }` from the data
    // layer (the helper always emits the struct, even when the project
    // has zero step images — see `data/project.ts` fallback). The card
    // must render NOTHING in this case (no broken `<img>`, no Play
    // placeholder). A future refactor flipping the default mediaType to
    // 'VIDEO' would otherwise turn every photoless project into a play-
    // icon placeholder — this test pins the empty-state behavior.
    it('renders nothing when latestPhoto is { url: null, mediaType: IMAGE } (empty-state guard)', () => {
      const emptyProject: RecentProject = {
        ...baseProject,
        latestPhoto: null,
      }
      render(<DashboardContinueCard project={emptyProject} />)
      expect(document.querySelector('img')).toBeNull()
      expect(screen.queryByTestId('project-card-video-poster')).not.toBeInTheDocument()
      expect(screen.queryByTestId('project-card-video-placeholder')).not.toBeInTheDocument()
      expect(screen.queryByTestId('video-play-overlay')).not.toBeInTheDocument()
    })
  })
})
