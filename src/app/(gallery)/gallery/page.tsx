export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'

export default async function GalleryIndexPage() {
  const projects = await prisma.project.findMany({
    where: {
      OR: [{ journeyGalleryEnabled: true }, { resultGalleryEnabled: true }],
      gallerySlug: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      gallerySlug: true,
      journeyGalleryEnabled: true,
      resultGalleryEnabled: true,
      hobby: { select: { id: true, name: true, color: true, icon: true } },
    },
  })

  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No public galleries yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Gallery</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const watermarkIcon = renderHobbyIcon(project.hobby.icon, {
            className: 'h-10 w-10 watermark-icon',
            style: { color: project.hobby.color },
          })
          return (
            <Card
              key={project.id}
              className="relative overflow-hidden"
              style={{ backgroundColor: hobbyColorWithAlpha(project.hobby.color, 0.12) }}
            >
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <HobbyIdentity hobby={project.hobby} variant="dot" />
                  <span className="font-medium">{project.name}</span>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {project.journeyGalleryEnabled && (
                    <Link href={`/gallery/${project.gallerySlug}`}>
                      <Badge variant="outline" className="text-xs hover:bg-accent cursor-pointer">Journey</Badge>
                    </Link>
                  )}
                  {project.resultGalleryEnabled && (
                    <Link href={`/gallery/${project.gallerySlug}/result`}>
                      <Badge variant="outline" className="text-xs hover:bg-accent cursor-pointer">Result</Badge>
                    </Link>
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
    </div>
  )
}
