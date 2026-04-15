import { SkeletonDashboardSection } from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <main className="max-w-5xl mx-auto p-4 space-y-8" role="status" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-8 w-48" />
      <SkeletonDashboardSection />
      <SkeletonDashboardSection />
      <SkeletonDashboardSection />
    </main>
  )
}
