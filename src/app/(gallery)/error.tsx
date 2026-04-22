'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface GalleryErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GalleryError({ error, reset }: GalleryErrorProps) {
  useEffect(() => {
    console.error('Gallery error boundary caught:', error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
      <AlertTriangle aria-hidden className="h-8 w-8 text-amber-600" />
      <h1 className="text-2xl font-semibold">Gallery unavailable</h1>
      <p className="text-muted-foreground">
        We couldn&apos;t load this gallery. It may have been disabled, or the
        link might be outdated.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} className="min-h-[44px]">
          Try again
        </Button>
        <Button variant="outline" asChild className="min-h-[44px]">
          <Link href="/gallery">Browse galleries</Link>
        </Button>
      </div>
    </div>
  )
}
