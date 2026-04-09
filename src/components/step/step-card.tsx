'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StepStatusSelect } from '@/components/step/step-status-select'
import { InlineNoteInput } from '@/components/note/inline-note-input'
import { NotesList } from '@/components/note/notes-list'
import { ImageGallery, type GalleryImage } from '@/components/image/image-gallery'
import { ImageUploadButton } from '@/components/image/image-upload-button'
import { ImageLinkInput } from '@/components/image/image-link-input'
import { InlineBlockerInput } from '@/components/blocker/inline-blocker-input'
import { BlockerCard } from '@/components/blocker/blocker-card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { updateStepState, updateStep, deleteStep } from '@/actions/step'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Input } from '@/components/ui/input'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { StepState } from '@/lib/step-states'

interface StepNoteData {
  id: string
  text: string
  createdAt: Date
}

interface StepBlockerData {
  id: string
  description: string
}

export interface StepCardData {
  id: string
  name: string
  state: StepState
  previousState: StepState | null
  sortOrder: number
  notes: StepNoteData[]
  images: GalleryImage[]
  blockers: StepBlockerData[]
}

interface StepCardProps {
  step: StepCardData
  variant: 'current' | 'other'
  isProjectCompleted: boolean
  index?: number
  total?: number
  onMoveUp?: (stepId: string) => void
  onMoveDown?: (stepId: string) => void
}

export function StepCard({
  step,
  variant,
  isProjectCompleted,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(variant === 'current')
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(step.name)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleEdit() {
    if (!editName.trim()) return
    startTransition(async () => {
      const result = await updateStep({ id: step.id, name: editName.trim() })
      if (result.success) {
        showSuccessToast('Step updated')
        setEditing(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteStep(step.id)
      if (result.success) {
        showSuccessToast('Step deleted')
        setDeleteOpen(false)
      } else {
        showErrorToast(result.error)
        setDeleteOpen(false)
      }
    })
  }

  function handleStateChange(newState: StepState) {
    startTransition(async () => {
      const result = await updateStepState({ id: step.id, state: newState })
      if (result.success) {
        showSuccessToast(`Step marked as ${newState.replace('_', ' ').toLowerCase()}`)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <>
    <Card data-testid={`step-card-${step.id}`}>
      <div className="flex items-center">
        {editing ? (
          <form
            className="flex-1 flex items-center gap-2 px-4 py-2"
            onSubmit={(e) => { e.preventDefault(); handleEdit() }}
          >
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              maxLength={200}
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!editName.trim() || isPending}>Save</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        ) : (
          <>
            <button
              type="button"
              className={cn(
                'flex flex-1 items-center justify-between gap-3 px-4 py-3 text-left',
                'min-h-[44px] cursor-pointer',
              )}
              aria-expanded={expanded}
              aria-controls={`step-content-${step.id}`}
              onClick={() => setExpanded((prev) => !prev)}
            >
              <span className="font-medium truncate">{step.name}</span>
            </button>
            {!isProjectCompleted && onMoveUp && onMoveDown && index !== undefined && total !== undefined && (
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === 0}
                  onClick={() => onMoveUp(step.id)}
                  aria-label="Move step up"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === total - 1}
                  onClick={() => onMoveDown(step.id)}
                  aria-label="Move step down"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            )}
            <StepStatusSelect
              currentState={step.state}
              previousState={step.previousState}
              onStateChange={handleStateChange}
              disabled={isPending || isProjectCompleted}
            />
            {!isProjectCompleted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] mr-2">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Step actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="min-h-[44px]" onClick={() => { setEditing(true); setEditName(step.name) }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="min-h-[44px] text-destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>

      <div
        id={`step-content-${step.id}`}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className={expanded ? '' : 'overflow-hidden'}>
          <CardContent className="space-y-6 pt-0">
            {/* Photos section */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Photos</h4>
              {step.images.length > 0 ? (
                <ImageGallery images={step.images} stepId={step.id} />
              ) : (
                <p className="text-sm text-muted-foreground">Add photos to document your progress.</p>
              )}
              {!isProjectCompleted && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <ImageUploadButton stepId={step.id} />
                  <ImageLinkInput stepId={step.id} />
                </div>
              )}
            </section>

            {/* Notes section */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Notes</h4>
              {!isProjectCompleted && <InlineNoteInput stepId={step.id} />}
              <NotesList notes={step.notes} isProjectCompleted={isProjectCompleted} />
            </section>

            {/* Blockers section — only show if blockers exist or project is active */}
            {(step.blockers.length > 0 || !isProjectCompleted) && (
              <section>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Blockers</h4>
                {step.blockers.map((blocker) => (
                  <BlockerCard key={blocker.id} id={blocker.id} description={blocker.description} />
                ))}
                {!isProjectCompleted && <InlineBlockerInput stepId={step.id} />}
              </section>
            )}
          </CardContent>
        </div>
      </div>
    </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => { if (!v) setDeleteOpen(false) }}
        title="Delete this step?"
        description="Notes, blockers, and images on this step will be removed."
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  )
}
