'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
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
          const thumbUrls = gallery.thumbnails

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

                {/* Thumbnails */}
                {thumbUrls.length > 0 && (
                  <div className="flex gap-1">
                    {thumbUrls.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                {/* Gallery type links — hobby colored, open in new tab */}
                <div className="flex items-center gap-3">
                  {gallery.journeyGalleryEnabled && (
                    <div className="flex items-center gap-1">
                      <a
                        href={`${origin}/gallery/${gallery.gallerySlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium hover:underline"
                        style={{ color: gallery.hobby.color }}
                      >
                        Journey
                      </a>
                      <CopyButton url={`${origin}/gallery/${gallery.gallerySlug}`} />
                    </div>
                  )}
                  {gallery.resultGalleryEnabled && (
                    <div className="flex items-center gap-1">
                      <a
                        href={`${origin}/gallery/${gallery.gallerySlug}/result`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium hover:underline"
                        style={{ color: gallery.hobby.color }}
                      >
                        Result
                      </a>
                      <CopyButton url={`${origin}/gallery/${gallery.gallerySlug}/result`} />
                    </div>
                  )}
                </div>
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
