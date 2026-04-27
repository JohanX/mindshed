import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectActions } from '@/components/project/project-actions'
import { ProjectStatusBadge } from '@/components/project/project-status-badge'
import { type StepCardData, type StepCardImage } from '@/components/step/step-card'
import { StepCardList } from '@/components/step/step-card-list'
import { AddStepForm } from '@/components/step/add-step-form'
import { EmptyStateCard } from '@/components/empty-state-card'
import type { StepState } from '@/lib/step-states'
import { deriveProjectStatus } from '@/lib/project-status'
import { getRemindersForTarget } from '@/actions/reminder'
import { ReminderBadge } from '@/components/reminder/reminder-badge'
import { ReminderDatePicker } from '@/components/reminder/reminder-date-picker'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'
import { GallerySection } from '@/components/gallery/gallery-section'
import { BomSection } from '@/components/bom/bom-section'
import type { BomItemData, InventoryOption } from '@/lib/bom'
import { getInventoryItemOptions } from '@/actions/inventory'

interface ProjectDetailPageProps {
  params: Promise<{ hobbyId: string; projectId: string }>
  searchParams: Promise<{ step?: string }>
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

function getThumbnailImageUrl(storageKey: string, width: number): string {
  const adapter = getImageStorageAdapter()
  if (!adapter) return ''
  try {
    return adapter.getThumbnailUrl(storageKey, width)
  } catch {
    return ''
  }
}

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const { hobbyId, projectId } = await params
  const { step: focusedStepParam } = await searchParams
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
            select: {
              id: true,
              name: true,
              type: true,
              quantity: true,
              isDeleted: true,
              images: {
                orderBy: { createdAt: 'asc' },
                take: 1,
                select: { type: true, storageKey: true, url: true },
              },
            },
          },
        },
      },
    },
  })

  if (!project || project.hobbyId !== hobbyId) notFound()

  const derivedStatus = deriveProjectStatus(project.steps)
  const isCompleted = derivedStatus === 'COMPLETED'

  const remindersResult = await getRemindersForTarget('PROJECT', projectId)
  const projectReminder = remindersResult.success ? (remindersResult.data[0] ?? null) : null

  // Determine which step to expand on load.
  // If ?step=<id> is provided AND matches a real step on this project (e.g.
  // navigating from a dashboard blocker), focus that step. Otherwise default
  // to the first IN_PROGRESS or NOT_STARTED step.
  const focusedFromUrl =
    focusedStepParam && project.steps.some((step) => step.id === focusedStepParam)
      ? focusedStepParam
      : null
  const currentStepId =
    focusedFromUrl ??
    project.steps.find((step) => step.state === 'IN_PROGRESS')?.id ??
    project.steps.find((step) => step.state === 'NOT_STARTED')?.id ??
    null

  // Map steps with nested data for StepCard
  const stepCards: StepCardData[] = project.steps.map((step) => ({
    id: step.id,
    name: step.name,
    state: step.state as StepState,
    previousState: (step.previousState as StepState | null) ?? null,
    sortOrder: step.sortOrder,
    notes: step.notes.map((note) => ({ id: note.id, text: note.text, createdAt: note.createdAt })),
    images: step.images.map((img): StepCardImage => {
      const isUpload = img.type === 'UPLOAD' && img.storageKey
      const fallback = img.url ?? ''
      return {
        id: img.id,
        displayUrl: isUpload ? getPublicImageUrl(img.storageKey!) : fallback,
        thumbnailUrl: isUpload
          ? getThumbnailImageUrl(img.storageKey!, THUMBNAIL_WIDTH.GRID)
          : fallback,
        stripThumbnailUrl: isUpload
          ? getThumbnailImageUrl(img.storageKey!, THUMBNAIL_WIDTH.STRIP)
          : fallback,
        originalFilename: img.originalFilename,
      }
    }),
    blockers: step.blockers.map((blocker) => ({
      id: blocker.id,
      description: blocker.description,
    })),
  }))

  // Gallery data
  const gallerySteps = project.steps.map((step) => ({
    id: step.id,
    name: step.name,
    state: step.state as string,
    hasImages: step.images.length > 0,
    excludeFromGallery: step.excludeFromGallery,
  }))

  const stepKey = stepCards
    .map(
      (step) =>
        `${step.id}:${step.state}:${step.notes.length}:${step.images.length}:${step.blockers.length}`,
    )
    .join(',')

  const bomRows: BomItemData[] = project.bomItems.map((bomItem) => {
    let heroThumbnailUrl: string | null = null
    const heroImage = bomItem.inventoryItem?.images?.[0] ?? null
    if (heroImage) {
      if (heroImage.type === 'UPLOAD' && heroImage.storageKey) {
        heroThumbnailUrl = getThumbnailImageUrl(heroImage.storageKey, THUMBNAIL_WIDTH.BOM_ROW)
      } else if (heroImage.url) {
        heroThumbnailUrl = heroImage.url
      }
    }
    return {
      id: bomItem.id,
      label: bomItem.label,
      requiredQuantity: bomItem.requiredQuantity,
      unit: bomItem.unit,
      sortOrder: bomItem.sortOrder,
      consumptionState: bomItem.consumptionState,
      inventoryItem: bomItem.inventoryItem
        ? {
            id: bomItem.inventoryItem.id,
            name: bomItem.inventoryItem.name,
            type: bomItem.inventoryItem.type,
            quantity: bomItem.inventoryItem.quantity,
            isDeleted: bomItem.inventoryItem.isDeleted,
            heroThumbnailUrl,
          }
        : null,
    }
  })

  const inventoryOptionsResult = await getInventoryItemOptions(hobbyId)
  const inventoryOptions: InventoryOption[] = inventoryOptionsResult.success
    ? inventoryOptionsResult.data
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        breadcrumbs={[
          { label: 'Hobbies', href: '/hobbies' },
          {
            label: project.hobby.name,
            href: `/hobbies/${hobbyId}`,
            hobbyColor: project.hobby.color,
          },
          { label: project.name },
        ]}
      >
        <div className="flex items-center gap-2">
          <ProjectStatusBadge status={derivedStatus} />
          {projectReminder && <ReminderBadge reminder={projectReminder} />}
          {!isCompleted && (
            <ReminderDatePicker
              targetType="PROJECT"
              targetId={projectId}
              existingReminder={projectReminder}
            />
          )}
          <ProjectActions
            project={{
              id: project.id,
              name: project.name,
              description: project.description,
              hobbyId: project.hobbyId,
            }}
          />
        </div>
      </PageHeader>

      {project.description && <p className="text-muted-foreground">{project.description}</p>}

      {stepCards.length > 0 ? (
        <StepCardList
          key={stepKey}
          initialSteps={stepCards}
          currentStepId={currentStepId}
          isProjectCompleted={isCompleted}
          projectId={project.id}
        />
      ) : null}

      {!isCompleted && <AddStepForm projectId={project.id} />}

      <BomSection
        projectId={project.id}
        initialRows={bomRows}
        initialInventoryOptions={inventoryOptions}
        projectSteps={project.steps.map((step) => ({
          id: step.id,
          name: step.name,
          state: step.state as StepState,
          sortOrder: step.sortOrder,
        }))}
      />

      {!project.isArchived && (
        <GallerySection
          projectId={project.id}
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
