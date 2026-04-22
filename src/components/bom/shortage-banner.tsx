'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { shortageRows, type BomItemData } from '@/lib/bom'

interface ShortageBannerProps {
  rows: BomItemData[]
}

export function ShortageBanner({ rows }: ShortageBannerProps) {
  const short = useMemo(() => shortageRows(rows), [rows])
  if (short.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
      <span>
        {short.length === 1
          ? '1 item is short for this project.'
          : `${short.length} items are short for this project.`}
      </span>
    </div>
  )
}
