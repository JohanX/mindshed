'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha, getReadableHobbyColor } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { Copy, Check, Globe, Play } from 'lucide-react'
import type { PublicGallery } from '@/lib/schemas/dashboard'

interface DashboardGalleriesSectionProps {
  galleries: PublicGallery[]
}

function CopyButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    // Read window.location.origin lazily so SSR markup matches the
    // initial client render — see the SSR-hydration note on the parent
    // section. Falls back to the relative path if the clipboard API is
    // unavailable.
    const absolute = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
    await navigator.clipboard.writeText(absolute)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0 min-h-[44px] min-w-[44px]"
      onClick={handleCopy}
      aria-label="Copy link"
    >
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

export function DashboardGalleriesSection({ galleries }: DashboardGalleriesSectionProps) {
  if (galleries.length === 0) return null

  // Hrefs render as relative paths so the SSR markup matches the
  // initial client render — `window.location.origin` is undefined on
  // the server. The CopyButton resolves the absolute URL at click time.

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-primary/20 pb-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Globe className="h-5 w-5 text-primary" />
          Public Galleries
        </h2>
        <Link href="/gallery" className="text-sm text-muted-foreground hover:text-foreground">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {galleries.map((gallery) => {
          // FR107: darkened-if-light hobby color so watermark stays visible.
          const readableHobbyColor = getReadableHobbyColor(gallery.hobby.color)
          const watermarkIcon = renderHobbyIcon(gallery.hobby.icon, {
            className: 'h-10 w-10 watermark-icon',
            style: { color: readableHobbyColor },
          })
          const thumbUrls = gallery.thumbnails

          return (
            <Card
              key={gallery.id}
              className="relative overflow-hidden transition-opacity hover:opacity-90"
              style={{ backgroundColor: hobbyColorWithAlpha(gallery.hobby.color) }}
            >
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <HobbyIdentity hobby={gallery.hobby} variant="dot" />
                  <span className="text-sm font-medium truncate">{gallery.name}</span>
                </div>

                {/* Thumbnails — Story 35.4 / FR137: VIDEO thumbs render
                    poster + play overlay (Cloudinary) or generic play-
                    icon card (S3 null poster). No `<video>` at thumb
                    size on the dashboard. */}
                {thumbUrls.length > 0 && (
                  <div className="flex gap-1">
                    {thumbUrls.map((thumb, i) => {
                      const isVideo = thumb.mediaType === 'VIDEO'
                      if (isVideo) {
                        return (
                          <div
                            key={i}
                            className="relative h-10 w-10 overflow-hidden rounded bg-muted"
                            data-testid="gallery-video-thumb"
                          >
                            {thumb.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb.posterUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Play className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div
                              className="absolute inset-0 flex items-center justify-center pointer-events-none"
                              data-testid="video-play-overlay"
                            >
                              <div className="rounded-full bg-black/60 p-1">
                                <Play className="h-3 w-3 fill-white text-white" />
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={thumb.url}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                          loading="lazy"
                        />
                      )
                    })}
                  </div>
                )}

                {/* Gallery type links — hobby colored, open in new tab */}
                <div className="flex items-center gap-3">
                  {gallery.journeyGalleryEnabled && (
                    <div className="flex items-center gap-1">
                      <a
                        href={`/gallery/${gallery.gallerySlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium hover:underline"
                        style={{ color: readableHobbyColor }}
                      >
                        Journey
                      </a>
                      <CopyButton path={`/gallery/${gallery.gallerySlug}`} />
                    </div>
                  )}
                  {gallery.resultGalleryEnabled && (
                    <div className="flex items-center gap-1">
                      <a
                        href={`/gallery/${gallery.gallerySlug}/result`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium hover:underline"
                        style={{ color: readableHobbyColor }}
                      >
                        Result
                      </a>
                      <CopyButton path={`/gallery/${gallery.gallerySlug}/result`} />
                    </div>
                  )}
                </div>
              </CardContent>
              {watermarkIcon && (
                <div
                  className="absolute bottom-2 right-2 z-10 pointer-events-none"
                  aria-hidden="true"
                >
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
