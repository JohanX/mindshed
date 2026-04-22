'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import type { BlockerWithContext } from '@/lib/schemas/blocker'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { resolveBlocker } from '@/actions/blocker'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

interface BlockerListProps {
  blockers: BlockerWithContext[]
}

function DashboardBlockerItem({ blocker }: { blocker: BlockerWithContext }) {
  const [isPending, startTransition] = useTransition()
  const hobby = blocker.step.project.hobby

  function handleResolve(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      const result = await resolveBlocker({ blockerId: blocker.id })
      if (result.success) {
        showSuccessToast('Blocker resolved')
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <li>
      <Link
        href={`/hobbies/${blocker.step.project.hobbyId}/projects/${blocker.step.project.id}`}
        className="block"
      >
        <div
          className="relative overflow-hidden flex items-center gap-3 rounded-lg p-3 transition-opacity hover:opacity-90"
          style={{ backgroundColor: hobbyColorWithAlpha(hobby.color) }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{blocker.description}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <HobbyIdentity hobby={hobby} variant="dot" />
              <span className="truncate">
                {blocker.step.project.name} / {blocker.step.name}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 min-h-[44px] min-w-[44px]"
            onClick={handleResolve}
            disabled={isPending}
            title="Resolve blocker"
            aria-label="Resolve blocker"
          >
            <Check className="h-4 w-4" />
          </Button>
          <span
            className="absolute bottom-1 right-2 z-10 pointer-events-none text-4xl font-bold leading-none select-none watermark-icon"
            style={{ color: 'hsl(0, 55%, 55%)' }}
            aria-hidden="true"
          >
            !
          </span>
        </div>
      </Link>
    </li>
  )
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
    <ul className="space-y-2">
      {blockers.map((blocker) => (
        <DashboardBlockerItem key={blocker.id} blocker={blocker} />
      ))}
    </ul>
  )
}
