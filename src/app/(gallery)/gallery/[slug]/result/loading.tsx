import { Skeleton } from '@/components/ui/skeleton'

export default function GalleryResultLoading() {
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
      <Skeleton className="aspect-video w-full rounded-lg" />
      <div className="flex justify-center gap-2">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-2 w-2 rounded-full" />
      </div>
    </div>
  )
}
