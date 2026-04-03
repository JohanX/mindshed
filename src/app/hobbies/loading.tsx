import { SkeletonBreadcrumb, SkeletonCard } from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

export default function HobbiesLoading() {
  return (
    <div className="space-y-6">
      <SkeletonBreadcrumb />
      <Skeleton className="h-8 w-32" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
