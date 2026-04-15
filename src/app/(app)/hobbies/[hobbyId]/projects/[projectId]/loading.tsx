import { SkeletonBreadcrumb, SkeletonStepCard } from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProjectLoading() {
  return (
    <div className="space-y-6">
      <SkeletonBreadcrumb />
      <Skeleton className="h-8 w-64" />
      <div className="space-y-3">
        <SkeletonStepCard />
        <SkeletonStepCard />
        <SkeletonStepCard />
      </div>
    </div>
  )
}
