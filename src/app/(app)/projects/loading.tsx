import { Skeleton } from '@/components/ui/skeleton'

export default function ProjectsLoading() {
  return (
    <div
      className="max-w-5xl mx-auto p-4 space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Loading projects"
    >
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
