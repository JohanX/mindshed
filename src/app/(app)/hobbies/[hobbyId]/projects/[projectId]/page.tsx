import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectActions } from '@/components/project/project-actions'
import { ProjectStatusBadge } from '@/components/project/project-status-badge'
import { type StepCardData } from '@/components/step/step-card'
import { StepCardList } from '@/components/step/step-card-list'
import { AddStepForm } from '@/components/step/add-step-form'
import { EmptyStateCard } from '@/components/empty-state-card'
import type { StepState } from '@/lib/step-states'
import { deriveProjectStatus } from '@/lib/project-status'
import { getRemindersForTarget } from '@/actions/reminder'
import { ReminderBadge } from '@/components/reminder/reminder-badge'
import { ReminderDatePicker } from '@/components/reminder/reminder-date-picker'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { GallerySection } from '@/components/gallery/gallery-section'
import { BomSection } from '@/components/bom/bom-section'
import type { BomItemData, InventoryOption } from '@/lib/bom'
import { getInventoryItemOptions } from '@/actions/inventory'

interface ProjectDetailPageProps {
  params: Promise<{ hobbyId: string; projectId: string }>
}

function getPublicImageUrl(storageKey: string): string {
  const adapter = getImageStorageAdapter()
  if (!adapter) return ''
  try {
    return adapter.getPublicUrl(storageKey)
  } catch {
    return ''
  }
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { hobbyId, projectId } = await params
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      hobby: true,
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: {
          notes: { orderBy: { createdAt: 'desc' } },
          images: { orderBy: { createdAt: 'desc' } },
          blockers: { where: { isResolved: false }, orderBy: { createdAt: 'desc' } },
        },
      },
      bomItems: {
        orderBy: { sortOrder: 'asc' },
        include: {
          inventoryItem: {
            select: { id: true, name: true, type: true, quantity: true, isDeleted: true },
          },
        },
      },
    },
  })

  if (!project || project.hobbyId !== hobbyId) notFound()

  const derivedStatus = deriveProjectStatus(project.steps)
  const isCompleted = derivedStatus === 'COMPLETED'

  const remindersResult = await getRemindersForTarget('PROJECT', projectId)
  const projectReminder = remindersResult.success ? remindersResult.data[0] ?? null : null

  // Compute current step (first IN_PROGRESS or NOT_STARTED)
  const currentStepId = project.steps.find(s => s.state === 'IN_PROGRESS')?.id
    ?? project.steps.find(s => s.state === 'NOT_STARTED')?.id
    ?? null

  // Map steps with nested data for StepCard
  const stepCards: StepCardData[] = project.steps.map(s => ({
    id: s.id,
    name: s.name,
    state: s.state as StepState,
    previousState: (s.previousState as StepState | null) ?? null,
    sortOrder: s.sortOrder,
    notes: s.notes.map(n => ({ id: n.id, text: n.text, createdAt: n.createdAt })),
    images: s.images.map(img => ({
      id: img.id,
      displayUrl: img.type === 'UPLOAD' && img.storageKey
        ? getPublicImageUrl(img.storageKey)
        : img.url ?? '',
      originalFilename: img.originalFilename,
    })),
    blockers: s.blockers.map(b => ({ id: b.id, description: b.description })),
  }))

  // Gallery data
  const gallerySteps = project.steps.map(s => ({
    id: s.id,
    name: s.name,
    state: s.state as string,
    hasImages: s.images.length > 0,
    excludeFromGallery: s.excludeFromGallery,
  }))

  const stepKey = stepCards.map(s => `${s.id}:${s.state}:${s.notes.length}:${s.images.length}:${s.blockers.length}`).join(',')

  const bomRows: BomItemData[] = project.bomItems.map(b => ({
    id: b.id,
    label: b.label,
    requiredQuantity: b.requiredQuantity,
    unit: b.unit,
    sortOrder: b.sortOrder,
    consumptionState: b.consumptionState,
    inventoryItem: b.inventoryItem,
  }))

  const inventoryOptionsResult = await getInventoryItemOptions()
  const inventoryOptions: InventoryOption[] = inventoryOptionsResult.success
    ? inventoryOptionsResult.data
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        breadcrumbs={[
          { label: 'Hobbies', href: '/hobbies' },
          { label: project.hobby.name, href: `/hobbies/${hobbyId}`, hobbyColor: project.hobby.color },
          { label: project.name },
        ]}
      >
        <div className="flex items-center gap-2">
          <ProjectStatusBadge status={derivedStatus} />
          {projectReminder && <ReminderBadge reminder={projectReminder} />}
          {!isCompleted && (
            <ReminderDatePicker targetType="PROJECT" targetId={projectId} existingReminder={projectReminder} />
          )}
          <ProjectActions project={{
            id: project.id,
            name: project.name,
            description: project.description,
            hobbyId: project.hobbyId,
          }} />
        </div>
      </PageHeader>

      {project.description && (
        <p className="text-muted-foreground">{project.description}</p>
      )}

      {stepCards.length > 0 ? (
        <StepCardList
          key={stepKey}
          initialSteps={stepCards}
          currentStepId={currentStepId}
          isProjectCompleted={isCompleted}
          projectId={project.id}
        />
      ) : null}

      {!isCompleted && (
        <AddStepForm projectId={project.id} />
      )}

      <BomSection
        projectId={project.id}
        initialRows={bomRows}
        initialInventoryOptions={inventoryOptions}
        projectSteps={project.steps.map((s) => ({
          id: s.id,
          name: s.name,
          state: s.state as StepState,
          sortOrder: s.sortOrder,
        }))}
      />

      {!project.isArchived && (
        <GallerySection
          projectId={project.id}
          projectName={project.name}
          journeyEnabled={project.journeyGalleryEnabled}
          resultEnabled={project.resultGalleryEnabled}
          gallerySlug={project.gallerySlug}
          resultStepId={project.resultStepId}
          steps={gallerySteps}
        />
      )}

      {stepCards.length === 0 && isCompleted && (
        <EmptyStateCard message="Add steps to track your progress." />
      )}
    </div>
  )
}
