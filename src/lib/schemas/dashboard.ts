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
  thumbnails: string[]
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
}
