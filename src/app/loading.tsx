import { SkeletonDashboardSection } from '@/components/skeletons'

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <SkeletonDashboardSection />
      <SkeletonDashboardSection />
      <SkeletonDashboardSection />
    </div>
  )
}
