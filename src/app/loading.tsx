import { SkeletonDashboardSection } from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-8" role="status" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-8 w-48" />
      <SkeletonDashboardSection />
      <SkeletonDashboardSection />
      <SkeletonDashboardSection />
    </div>
  )
}
