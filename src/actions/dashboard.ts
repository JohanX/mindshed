'use server'

import { prisma } from '@/lib/db'
import { IDLE_THRESHOLD_DAYS } from '@/lib/constants'
import type { ActionResult } from '@/lib/action-result'
import type { DashboardData, RecentProject, ActiveBlocker, IdleProject } from '@/lib/schemas/dashboard'

export async function getDashboardData(): Promise<ActionResult<DashboardData>> {
  try {
    const [totalHobbies, rawRecentProjects, rawActiveBlockers, rawIdleProjects] = await Promise.all([
      // Total hobby count
      prisma.hobby.count(),

      // 5 most recent active projects
      prisma.project.findMany({
        where: { isArchived: false, isCompleted: false },
        orderBy: { lastActivityAt: 'desc' },
        take: 5,
        include: {
          hobby: { select: { id: true, name: true, color: true, icon: true } },
          steps: {
            select: { id: true, name: true, state: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),

      // All active blockers with context
      prisma.blocker.findMany({
        where: { isResolved: false },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          description: true,
          step: {
            select: {
              id: true,
              name: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  hobbyId: true,
                  hobby: { select: { id: true, name: true, color: true, icon: true } },
                },
              },
            },
          },
        },
      }),

      // Idle projects
      (() => {
        const thresholdDate = new Date()
        thresholdDate.setDate(thresholdDate.getDate() - IDLE_THRESHOLD_DAYS)
        return prisma.project.findMany({
          where: {
            isArchived: false,
            isCompleted: false,
            lastActivityAt: { lt: thresholdDate },
          },
          orderBy: { lastActivityAt: 'asc' },
          include: {
            hobby: { select: { id: true, name: true, color: true, icon: true } },
            steps: {
              select: { id: true, name: true, state: true, sortOrder: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        })
      })(),
    ])

    // Map recent projects with computed current step + latest photo
    const recentProjects: RecentProject[] = await Promise.all(
      rawRecentProjects.map(async (p) => {
        const currentStepData = p.steps.find(s => s.state === 'IN_PROGRESS')
          ?? p.steps.find(s => s.state === 'NOT_STARTED')

        // Get latest photo across all steps
        const latestPhoto = await prisma.stepImage.findFirst({
          where: { step: { projectId: p.id } },
          orderBy: { createdAt: 'desc' },
          select: { storageKey: true, originalFilename: true },
        })

        return {
          id: p.id,
          name: p.name,
          lastActivityAt: p.lastActivityAt,
          hobbyId: p.hobbyId,
          hobby: p.hobby,
          currentStep: currentStepData ? { id: currentStepData.id, name: currentStepData.name } : null,
          latestPhoto,
        }
      }),
    )

    const activeBlockers: ActiveBlocker[] = rawActiveBlockers.map(b => ({
      id: b.id,
      description: b.description,
      step: {
        id: b.step.id,
        name: b.step.name,
        project: {
          id: b.step.project.id,
          name: b.step.project.name,
          hobbyId: b.step.project.hobbyId,
          hobby: b.step.project.hobby,
        },
      },
    }))

    const idleProjects: IdleProject[] = rawIdleProjects.map(p => {
      const currentStepData = p.steps.find(s => s.state === 'IN_PROGRESS')
        ?? p.steps.find(s => s.state === 'NOT_STARTED')
      return {
        id: p.id,
        name: p.name,
        lastActivityAt: p.lastActivityAt,
        hobbyId: p.hobbyId,
        hobby: p.hobby,
        currentStep: currentStepData ? { id: currentStepData.id, name: currentStepData.name } : null,
      }
    })

    return {
      success: true,
      data: { totalHobbies, recentProjects, activeBlockers, idleProjects },
    }
  } catch (error) {
    console.error('getDashboardData failed:', error)
    return { success: false, error: 'Failed to load dashboard' }
  }
}
