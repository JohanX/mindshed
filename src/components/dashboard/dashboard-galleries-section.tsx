'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { Copy, Check } from 'lucide-react'
import type { PublicGallery } from '@/lib/schemas/dashboard'

interface DashboardGalleriesSectionProps {
  galleries: PublicGallery[]
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0 h-7 w-7"
      onClick={handleCopy}
      aria-label="Copy link"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

export function DashboardGalleriesSection({ galleries }: DashboardGalleriesSectionProps) {
  if (galleries.length === 0) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Public Galleries</h2>
        <Link href="/gallery" className="text-sm text-muted-foreground hover:text-foreground">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {galleries.map((gallery) => {
          const watermarkIcon = renderHobbyIcon(gallery.hobby.icon, {
            className: 'h-10 w-10',
            style: { color: gallery.hobby.color, opacity: 0.08 },
          })
          return (
            <Card
              key={gallery.id}
              className="relative overflow-hidden transition-opacity hover:opacity-90"
              style={{ backgroundColor: hobbyColorWithAlpha(gallery.hobby.color, 0.12) }}
            >
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <HobbyIdentity hobby={gallery.hobby} variant="dot" />
                  <span className="text-sm font-medium truncate">{gallery.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {gallery.journeyGalleryEnabled && (
                    <Badge variant="outline" className="text-xs">Journey</Badge>
                  )}
                  {gallery.resultGalleryEnabled && (
                    <Badge variant="outline" className="text-xs">Result</Badge>
                  )}
                </div>
                {gallery.journeyGalleryEnabled && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="truncate font-mono">/gallery/{gallery.gallerySlug}</span>
                    <CopyButton url={`${origin}/gallery/${gallery.gallerySlug}`} />
                  </div>
                )}
                {gallery.resultGalleryEnabled && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="truncate font-mono">/gallery/{gallery.gallerySlug}/result</span>
                    <CopyButton url={`${origin}/gallery/${gallery.gallerySlug}/result`} />
                  </div>
                )}
              </CardContent>
              {watermarkIcon && (
                <div className="absolute bottom-2 right-2 z-10 pointer-events-none" aria-hidden="true">
                  {watermarkIcon}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </section>
  )
}
