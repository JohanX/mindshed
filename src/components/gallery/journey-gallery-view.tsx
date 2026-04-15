import { HobbyIdentity } from '@/components/hobby/hobby-identity'

interface JourneyStep {
  name: string
  notes: { text: string }[]
  images: { displayUrl: string; originalFilename: string | null }[]
}

interface JourneyGalleryViewProps {
  project: {
    name: string
    description: string | null
    hobby: { name: string; color: string; icon: string | null }
  }
  steps: JourneyStep[]
}

export function JourneyGalleryView({ project, steps }: JourneyGalleryViewProps) {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-lg text-muted-foreground">{project.description}</p>
        )}
        <HobbyIdentity hobby={project.hobby} variant="badge" />
      </header>

      {steps.map((step, index) => (
        <section key={index} className="space-y-4 pt-4 border-t border-border">
          <h2 className="text-xl font-semibold">{step.name}</h2>

          {step.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {step.images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={img.displayUrl}
                  alt={img.originalFilename ?? `${step.name} image ${i + 1}`}
                  className="rounded-lg w-full aspect-square object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          )}

          {step.notes.length > 0 && (
            <div className="space-y-2">
              {step.notes.map((note, i) => (
                <p key={i} className="text-sm text-muted-foreground whitespace-pre-line">
                  {note.text}
                </p>
              ))}
            </div>
          )}
        </section>
      ))}

      {steps.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No steps to display.</p>
      )}
    </article>
  )
}
