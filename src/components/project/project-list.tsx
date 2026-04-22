'use client'

import { useState } from 'react'
import { ProjectCard } from '@/components/project/project-card'
import { Button } from '@/components/ui/button'
import type { ProjectWithProgress } from '@/actions/project'

interface ProjectListProps {
  projects: ProjectWithProgress[]
  hobby: { name: string; color: string; icon: string | null }
}

export function ProjectList({ projects, hobby }: ProjectListProps) {
  const [showArchived, setShowArchived] = useState(false)

  const activeProjects = projects.filter(
    (project) => !project.isArchived && project.derivedStatus !== 'COMPLETED',
  )
  const archivedProjects = projects.filter(
    (project) => project.isArchived || project.derivedStatus === 'COMPLETED',
  )

  return (
    <div className="space-y-6">
      {activeProjects.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeProjects.map((project) => (
            <ProjectCard key={project.id} project={project} hobby={hobby} />
          ))}
        </div>
      )}

      {archivedProjects.length > 0 && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="text-muted-foreground min-h-[44px]"
          >
            {showArchived ? 'Hide archived' : `Show archived (${archivedProjects.length})`}
          </Button>

          {showArchived && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
              {archivedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} hobby={hobby} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
