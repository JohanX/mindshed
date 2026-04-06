import { SkeletonBreadcrumb, SkeletonCard } from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonBreadcrumb />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
