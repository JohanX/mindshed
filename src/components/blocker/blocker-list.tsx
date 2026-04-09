'use client'

import Link from 'next/link'
import type { BlockerWithContext } from '@/lib/schemas/blocker'
import { BlockerCard } from '@/components/blocker/blocker-card'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'

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
      {blockers.map((blocker) => {
        const hobby = blocker.step.project.hobby
        const watermarkIcon = renderHobbyIcon(hobby.icon, {
          className: 'h-10 w-10',
          style: { color: hobby.color, opacity: 0.08 },
        })
        return (
          <li
            key={blocker.id}
            className="relative overflow-hidden space-y-1 rounded-lg p-3"
            style={{ backgroundColor: hobbyColorWithAlpha(hobby.color, 0.12) }}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HobbyIdentity hobby={hobby} variant="badge" />
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
            {watermarkIcon && (
              <div className="absolute bottom-2 right-2 z-10 pointer-events-none" aria-hidden="true">
                {watermarkIcon}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
