'use client'

import type { ActiveBlocker } from '@/lib/schemas/dashboard'
import { BlockerList } from '@/components/blocker/blocker-list'

interface DashboardBlockersSectionProps {
  blockers: ActiveBlocker[]
}

export function DashboardBlockersSection({ blockers }: DashboardBlockersSectionProps) {
  // Map ActiveBlocker to BlockerWithContext shape expected by BlockerList
  const mapped = blockers.map((b) => ({
    id: b.id,
    description: b.description,
    isResolved: false as const,
    createdAt: new Date(),
    step: {
      name: b.step.name,
      project: {
        id: b.step.project.id,
        name: b.step.project.name,
        hobbyId: b.step.project.hobbyId,
        hobby: b.step.project.hobby,
      },
    },
  }))

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Active Blockers</h2>
      <BlockerList blockers={mapped} />
    </section>
  )
}
