import { Skeleton } from '@/components/ui/skeleton'

/** Skeleton for a section header (e.g., "Active Blockers") */
export function SkeletonSectionHeader() {
  return <Skeleton className="h-6 w-40" />
}

/** Skeleton for a standard card (dashboard card, hobby card, etc.) */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

/** Skeleton for a dashboard section (header + 2 cards) */
export function SkeletonDashboardSection() {
  return (
    <div className="space-y-4">
      <SkeletonSectionHeader />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

/** Skeleton for breadcrumb navigation */
export function SkeletonBreadcrumb() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-20" />
      <span className="text-muted-foreground">/</span>
      <Skeleton className="h-4 w-24" />
      <span className="text-muted-foreground">/</span>
      <Skeleton className="h-4 w-28" />
    </div>
  )
}

/** Skeleton for a step card (used in project view) */
export function SkeletonStepCard() {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

/** Skeleton for an image gallery grid */
export function SkeletonImageGallery() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-xl" />
      ))}
    </div>
  )
}
