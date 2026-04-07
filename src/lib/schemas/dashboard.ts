export interface DashboardData {
  totalHobbies: number
  recentProjects: RecentProject[]
  activeBlockers: ActiveBlocker[]
  idleProjects: IdleProject[]
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
