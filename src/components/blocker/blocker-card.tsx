'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { resolveBlocker } from '@/actions/blocker'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

interface BlockerCardProps {
  id: string
  description: string
}

export function BlockerCard({ id, description }: BlockerCardProps) {
  const [isPending, startTransition] = useTransition()

  function handleResolve() {
    startTransition(async () => {
      const result = await resolveBlocker({ blockerId: id })
      if (result.success) {
        showSuccessToast('Blocker resolved')
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <p className="text-sm">{description}</p>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 min-h-[44px] transition-opacity motion-reduce:transition-none"
        style={{ borderColor: 'hsl(220, 15%, 55%)', color: 'hsl(220, 15%, 55%)' }}
        onClick={handleResolve}
        disabled={isPending}
      >
        {isPending ? 'Resolving...' : 'Resolve'}
      </Button>
    </div>
  )
}
