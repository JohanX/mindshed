import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectActions } from '@/components/project/project-actions'
import { ProjectStatusBadge } from '@/components/project/project-status-badge'
import { type StepCardData, type StepCardImage } from '@/components/step/step-card'
import { StepCardListWithCompletion } from '@/components/step/step-card-list-with-completion'
import { StepFocusScroll } from '@/components/step/step-focus-scroll'
import { AddStepForm } from '@/components/step/add-step-form'
import { EmptyStateCard } from '@/components/empty-state-card'
import type { StepState } from '@/lib/step-states'
import { deriveProjectStatus } from '@/lib/project-status'
import { computeProjectTotalHours } from '@/lib/project-hours'
import { formatHours } from '@/lib/hours-format'
import { getRemindersForTarget } from '@/actions/reminder'
import { ReminderBadge } from '@/components/reminder/reminder-badge'
import { ReminderDatePicker } from '@/components/reminder/reminder-date-picker'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'
import { GallerySection } from '@/components/gallery/gallery-section'
import { BomSection } from '@/components/bom/bom-section'
import type { BomItemData, InventoryOption } from '@/lib/bom'
import { getInventoryItemOptions } from '@/actions/inventory'
import { findProjectDetail } from '@/data/project'

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

/**
 * Story 35.3 / FR136 — video poster URL for VIDEO step images.
 * Cloudinary derives via `so_auto` URL transform; S3 returns null.
 * Returns null for IMAGE rows (caller-side discipline enforces the
 * `mediaType === 'VIDEO'` gate per adapter.ts JSDoc).
 */
function getVideoPosterImageUrl(storageKey: string, width: number): string | null {
  const adapter = getImageStorageAdapter()
  if (!adapter) return null
  try {
    return adapter.getVideoPosterUrl(storageKey, width)
  } catch {
    return null
  }
}

/**
 * Story 35.3 / FR136 — video URL for VIDEO step images. Cloudinary
 * uses `/video/upload/<key>`; S3 mirrors getPublicUrl.
 */
function getVideoImageUrl(storageKey: string): string {
  const adapter = getImageStorageAdapter()
  if (!adapter) return ''
  try {
    return adapter.getVideoUrl(storageKey)
  } catch {
    return ''
  }
}

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const { hobbyId, projectId } = await params
  const { step: focusedStepParam } = await searchParams
  const project = await findProjectDetail(projectId)

  if (!project || project.hobbyId !== hobbyId) notFound()

  // Story 30.3 / FR127: lock state is the user-driven `project.isCompleted`
  // flag — NOT the derived step status. The badge below still uses
  // `derivedStatus` (visual progress indicator, unchanged). A project where
  // all steps are COMPLETED but the user picked "Not yet" / never opened
  // the dialog will show a "Completed" badge while remaining editable.
  const derivedStatus = deriveProjectStatus(project.steps)
  const isCompleted = project.isCompleted

  // Story 30.5 / FR129 — project total hours, null when hobby tracking is off.
  const totalHoursLogged = computeProjectTotalHours(
    project.steps,
    project.hobby.hoursTrackingEnabled,
  )
  const formattedHours = formatHours(totalHoursLogged)

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
      const isVideo = img.mediaType === 'VIDEO'
      const fallback = img.url ?? ''
      // Story 35.3 / FR136 — VIDEO uploads serve the playable URL from
      // adapter.getVideoUrl (Cloudinary /video/upload/<key>; S3 mirrors
      // getPublicUrl). VIDEO LINK rows use the stored url verbatim.
      const displayUrl = isUpload
        ? isVideo
          ? getVideoImageUrl(img.storageKey!)
          : getPublicImageUrl(img.storageKey!)
        : fallback
      return {
        id: img.id,
        displayUrl,
        // For VIDEO rows, the thumbnail site (collapsed step strip)
        // shows the poster — same shape as the gallery tile's poster.
        thumbnailUrl: isUpload
          ? isVideo
            ? (getVideoPosterImageUrl(img.storageKey!, THUMBNAIL_WIDTH.GRID) ?? '')
            : getThumbnailImageUrl(img.storageKey!, THUMBNAIL_WIDTH.GRID)
          : fallback,
        stripThumbnailUrl: isUpload
          ? isVideo
            ? (getVideoPosterImageUrl(img.storageKey!, THUMBNAIL_WIDTH.STRIP) ?? '')
            : getThumbnailImageUrl(img.storageKey!, THUMBNAIL_WIDTH.STRIP)
          : fallback,
        originalFilename: img.originalFilename,
        // Story 35.3 — pass mediaType through so the gallery tile +
        // lightbox can branch on it.
        mediaType: img.mediaType,
        durationSeconds: img.durationSeconds,
        // resolveVideoPosterUrl is gated on isUpload + isVideo so IMAGE
        // rows always pass `posterUrl: null` (no 404-prone URL leaks).
        posterUrl:
          isUpload && isVideo
            ? getVideoPosterImageUrl(img.storageKey!, THUMBNAIL_WIDTH.GRID)
            : null,
      }
    }),
    blockers: step.blockers.map((blocker) => ({
      id: blocker.id,
      description: blocker.description,
    })),
    hoursLogged: (() => {
      // Defensive: Number(prismaDecimal) returns NaN for any non-numeric
      // input; we round-trip via Number.isFinite to surface only valid
      // values to the React tree (avoids `NaNh` rendering in StepCard).
      if (step.hoursLogged === null) return null
      const n = Number(step.hoursLogged)
      return Number.isFinite(n) ? n : null
    })(),
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
          {formattedHours && (
            <span className="text-sm text-muted-foreground" data-testid="project-total-hours">
              {formattedHours}
            </span>
          )}
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
              isCompleted: project.isCompleted,
            }}
          />
        </div>
      </PageHeader>

      {project.description && <p className="text-muted-foreground">{project.description}</p>}

      {stepCards.length > 0 ? (
        <>
          <StepCardListWithCompletion
            stepKey={stepKey}
            initialSteps={stepCards}
            currentStepId={currentStepId}
            isProjectCompleted={isCompleted}
            hobbyTracksHours={project.hobby.hoursTrackingEnabled}
            projectId={project.id}
          />
          {/*
            FR116: scroll the focused step into view. Rendered OUTSIDE the
            keyed StepCardList so it isn't remounted by every revalidate
            (which would re-fire the scroll on note/image/blocker mutations).
          */}
          <StepFocusScroll focusedStepId={currentStepId} />
        </>
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
