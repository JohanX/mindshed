'use client'

import { OctagonAlert } from 'lucide-react'
import type { ActiveBlocker } from '@/lib/schemas/dashboard'
import { BlockerList } from '@/components/blocker/blocker-list'

interface DashboardBlockersSectionProps {
  blockers: ActiveBlocker[]
}

export function DashboardBlockersSection({ blockers }: DashboardBlockersSectionProps) {
  // Map ActiveBlocker to BlockerWithContext shape expected by BlockerList
  const mapped = blockers.map((blocker) => ({
    id: blocker.id,
    description: blocker.description,
    isResolved: false as const,
    createdAt: blocker.createdAt,
    step: {
      name: blocker.step.name,
      project: {
        id: blocker.step.project.id,
        name: blocker.step.project.name,
        hobbyId: blocker.step.project.hobbyId,
        hobby: blocker.step.project.hobby,
      },
    },
  }))

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold border-b border-primary/20 pb-2">
        <OctagonAlert className="h-5 w-5 text-primary" />
        Active Blockers
      </h2>
      <BlockerList blockers={mapped} />
    </section>
  )
}
