import { getDashboardData } from '@/actions/dashboard'
import { getDashboardReminders } from '@/actions/reminder'
import { getOverdueMaintenanceItems } from '@/actions/inventory'
import { DashboardContinueSection } from '@/components/dashboard/dashboard-continue-section'
import { DashboardBlockersSection } from '@/components/dashboard/dashboard-blockers-section'
import { DashboardIdleSection } from '@/components/dashboard/dashboard-idle-section'
import { DashboardReminderCard } from '@/components/dashboard/dashboard-reminder-card'
import { DashboardMaintenanceCard } from '@/components/dashboard/dashboard-maintenance-card'
import { EmptyStateCard } from '@/components/empty-state-card'
import { HobbyFormDialog } from '@/components/hobby/hobby-form'

export default async function DashboardPage() {
  const [result, remindersResult, maintenanceResult] = await Promise.all([
    getDashboardData(),
    getDashboardReminders(),
    getOverdueMaintenanceItems(),
  ])

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            Something went wrong loading the dashboard. Please try again later.
          </p>
        </div>
      </main>
    )
  }

  const { totalHobbies, recentProjects, activeBlockers, idleProjects } = result.data
  const reminders = remindersResult.success ? remindersResult.data : []
  const maintenanceDue = maintenanceResult.success ? maintenanceResult.data : []

  // First-time user — no hobbies at all
  if (totalHobbies === 0) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <EmptyStateCard message="Welcome to MindShed! Add your first hobby to get started.">
          <HobbyFormDialog />
        </EmptyStateCard>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <DashboardContinueSection projects={recentProjects} />
      {reminders.length > 0 && (
        <>
          <hr className="border-border" />
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Reminders</h2>
            <div className="space-y-2">
              {reminders.map((r) => (
                <DashboardReminderCard key={r.id} reminder={r} />
              ))}
            </div>
          </section>
        </>
      )}
      {activeBlockers.length > 0 && <hr className="border-border" />}
      <DashboardBlockersSection blockers={activeBlockers} />
      {idleProjects.length > 0 && <hr className="border-border" />}
      <DashboardIdleSection projects={idleProjects} />
      {maintenanceDue.length > 0 && (
        <>
          <hr className="border-border" />
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Maintenance Due</h2>
            <div className="space-y-2">
              {maintenanceDue.map((item) => (
                <DashboardMaintenanceCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
