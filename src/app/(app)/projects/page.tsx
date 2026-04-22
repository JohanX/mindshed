import { PageHeader } from '@/components/layout/page-header'
import { ProjectCard } from '@/components/project/project-card'
import { EmptyStateCard } from '@/components/empty-state-card'
import { getAllProjects } from '@/actions/project'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AllProjectsPage() {
  const result = await getAllProjects()
  const projects = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader title="All Projects" breadcrumbs={[{ label: 'All Projects' }]} />

      {!result.success ? (
        <EmptyStateCard message="Failed to load projects. Please refresh." />
      ) : projects.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} hobby={project.hobby} showHobbyBadge />
          ))}
        </div>
      ) : (
        <EmptyStateCard message="No active projects yet. Browse your hobbies to start one!">
          <Link href="/hobbies">
            <Button variant="outline">Browse Hobbies</Button>
          </Link>
        </EmptyStateCard>
      )}
    </div>
  )
}
