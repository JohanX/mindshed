import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { ImageSlideshow } from '@/components/gallery/image-slideshow'

interface ResultGalleryViewProps {
  project: {
    name: string
    description: string | null
    hobby: { name: string; color: string; icon: string | null }
  }
  images: { displayUrl: string; originalFilename: string | null }[]
}

export function ResultGalleryView({ project, images }: ResultGalleryViewProps) {
  return (
    <article className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-lg text-muted-foreground">{project.description}</p>
        )}
        <div className="flex justify-center">
          <HobbyIdentity hobby={project.hobby} variant="badge" />
        </div>
      </header>

      {images.length > 0 ? (
        <ImageSlideshow images={images} />
      ) : (
        <p className="text-center text-muted-foreground py-12">No images available</p>
      )}
    </article>
  )
}
