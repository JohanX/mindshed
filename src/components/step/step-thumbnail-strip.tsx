import { ImageOff } from 'lucide-react'
import { useState } from 'react'

interface StepThumbnailStripProps {
  images: { id: string; displayUrl: string }[]
  maxVisible?: number
}

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false)

  if (broken || !src) {
    return (
      <div className="h-10 w-10 shrink-0 rounded-md bg-muted flex items-center justify-center">
        <ImageOff className="h-3 w-3 text-muted-foreground" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-10 shrink-0 rounded-md object-cover"
      loading="lazy"
      onError={() => setBroken(true)}
    />
  )
}

export function StepThumbnailStrip({ images, maxVisible = 4 }: StepThumbnailStripProps) {
  if (images.length === 0) return null

  const visible = images.slice(0, maxVisible)
  const overflow = images.length - maxVisible

  return (
    <div
      className="flex items-center gap-1 shrink-0"
      aria-label={`Step has ${images.length} photos`}
    >
      {visible.map((img) => (
        <Thumbnail key={img.id} src={img.displayUrl} alt="" />
      ))}
      {overflow > 0 && (
        <span className="text-xs text-muted-foreground font-medium px-1">
          +{overflow}
        </span>
      )}
    </div>
  )
}
