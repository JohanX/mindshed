'use client'

import Link from 'next/link'
import type { BlockerWithContext } from '@/lib/schemas/blocker'
import { BlockerCard } from '@/components/blocker/blocker-card'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'

interface BlockerListProps {
  blockers: BlockerWithContext[]
}

export function BlockerList({ blockers }: BlockerListProps) {
  if (blockers.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No blockers — all clear!
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {blockers.map((blocker) => (
        <li key={blocker.id} className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HobbyIdentity hobby={blocker.step.project.hobby} variant="badge" />
            <span aria-hidden="true">/</span>
            <Link
              href={`/hobbies/${blocker.step.project.hobbyId}/projects/${blocker.step.project.id}`}
              className="hover:underline"
            >
              {blocker.step.project.name}
            </Link>
            <span aria-hidden="true">/</span>
            <span>{blocker.step.name}</span>
          </div>
          <BlockerCard id={blocker.id} description={blocker.description} />
        </li>
      ))}
    </ul>
  )
}
