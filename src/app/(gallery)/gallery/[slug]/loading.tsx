import { Skeleton } from '@/components/ui/skeleton'

export default function GalleryJourneyLoading() {
  return (
    <div
      className="max-w-4xl mx-auto p-4 space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Loading gallery"
    >
      <div className="space-y-2">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-lg border p-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <Skeleton className="aspect-square w-full rounded" />
            <Skeleton className="aspect-square w-full rounded" />
            <Skeleton className="aspect-square w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
