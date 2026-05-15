export interface PublicGallery {
  id: string
  name: string
  hobbyId: string
  gallerySlug: string
  journeyGalleryEnabled: boolean
  resultGalleryEnabled: boolean
  hobby: {
    id: string
    name: string
    color: string
    icon: string | null
  }
  // Story 35.4 / FR137 — each thumbnail carries optional mediaType +
  // posterUrl so the dashboard galleries section can render VIDEO leads
  // as poster + play overlay (Cloudinary) or generic play-icon card (S3
  // null poster). Undefined mediaType = implicit IMAGE (back-compat).
  thumbnails: {
    url: string
    mediaType?: 'IMAGE' | 'VIDEO'
    posterUrl?: string | null
  }[]
}

export interface DashboardData {
  totalHobbies: number
  recentProjects: RecentProject[]
  activeBlockers: ActiveBlocker[]
  idleProjects: IdleProject[]
  publicGalleries: PublicGallery[]
}

export interface RecentProject {
  id: string
  name: string
  lastActivityAt: Date
  hobbyId: string
  hobby: {
    id: string
    name: string
    color: string
    icon: string | null
  }
  currentStep: {
    id: string
    name: string
  } | null
  latestPhoto: {
    storageKey: string | null
    originalFilename: string | null
  } | null
  totalSteps: number
  completedSteps: number
  derivedStatus: import('@/lib/project-status').DerivedProjectStatus
  /** Story 30.5 / FR129 — null when the parent hobby has tracking disabled. */
  totalHoursLogged: number | null
}

export interface ActiveBlocker {
  id: string
  description: string
  createdAt: Date
  step: {
    id: string
    name: string
    project: {
      id: string
      name: string
      hobbyId: string
      hobby: {
        id: string
        name: string
        color: string
        icon: string | null
      }
    }
  }
}

export interface IdleProject {
  id: string
  name: string
  lastActivityAt: Date
  hobbyId: string
  hobby: {
    id: string
    name: string
    color: string
    icon: string | null
  }
  currentStep: {
    id: string
    name: string
  } | null
  /** Story 30.5 / FR129 — null when the parent hobby has tracking disabled. */
  totalHoursLogged: number | null
}
