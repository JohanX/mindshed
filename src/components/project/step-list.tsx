'use client'

import { useState, useRef, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StepStateBadge } from '@/components/step-state-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { createStep, updateStep, deleteStep, updateStepState, reorderSteps } from '@/actions/step'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, MoreHorizontal, Pencil, Trash2, Check, Play, Loader2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import type { StepState } from '@/lib/step-states'

interface StepData {
  id: string
  name: string
  state: StepState
  sortOrder: number
}

interface StepListProps {
  steps: StepData[]
  projectId: string
  isCompleted: boolean
}

function SortableStepItem({
  step,
  index,
  total,
  isCompleted,
  editingStepId,
  editName,
  setEditName,
  isPending,
  onEditStep,
  onCancelEdit,
  onStartEdit,
  onDeleteStep,
  onStateChange,
  onMoveUp,
  onMoveDown,
}: {
  step: StepData
  index: number
  total: number
  isCompleted: boolean
  editingStepId: string | null
  editName: string
  setEditName: (v: string) => void
  isPending: boolean
  onEditStep: (id: string) => void
  onCancelEdit: () => void
  onStartEdit: (id: string, name: string) => void
  onDeleteStep: (id: string) => void
  onStateChange: (id: string, state: StepState) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      {!isCompleted && (
        <>
          {/* Desktop drag handle */}
          <button
            className="hidden lg:flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>

          {/* Mobile up/down buttons */}
          <div className="flex flex-col gap-0.5 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              disabled={index === 0}
              onClick={() => onMoveUp(step.id)}
              aria-label="Move step up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              disabled={index === total - 1}
              onClick={() => onMoveDown(step.id)}
              aria-label="Move step down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      <div className="flex-1">
        <Card>
          <CardContent className="flex items-center justify-between gap-2">
            {editingStepId === step.id ? (
              <form
                className="flex-1 flex gap-2"
                onSubmit={(e) => { e.preventDefault(); onEditStep(step.id) }}
              >
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  maxLength={200}
                />
                <Button type="submit" size="sm" disabled={!editName.trim() || isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {!isCompleted && step.state === 'NOT_STARTED' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 min-h-[44px] min-w-[44px]"
                      onClick={() => onStateChange(step.id, 'IN_PROGRESS')}
                      title="Start step"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  {!isCompleted && step.state === 'IN_PROGRESS' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 min-h-[44px] min-w-[44px]"
                      onClick={() => onStateChange(step.id, 'COMPLETED')}
                      title="Mark complete"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <span className="font-medium truncate" data-testid="step-name">{step.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StepStateBadge state={step.state} size="sm" />
                  {!isCompleted && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Step actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="min-h-[44px]" onClick={() => onStartEdit(step.id, step.name)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="min-h-[44px] text-destructive" onClick={() => onDeleteStep(step.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function StepList({ steps: initialSteps, projectId, isCompleted }: StepListProps) {
  const [steps, setSteps] = useState(initialSteps)
  const lastConfirmedOrderRef = useRef(initialSteps)
  const [newStepName, setNewStepName] = useState('')
  const [addingStep, setAddingStep] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteStepId, setDeleteStepId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function persistOrder(newSteps: StepData[]) {
    startTransition(async () => {
      const result = await reorderSteps({
        projectId,
        orderedStepIds: newSteps.map(s => s.id),
      })
      if (result.success) {
        lastConfirmedOrderRef.current = newSteps
      } else {
        showErrorToast(result.error)
        setSteps(lastConfirmedOrderRef.current)
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = steps.findIndex(s => s.id === active.id)
    const newIndex = steps.findIndex(s => s.id === over.id)
    const newSteps = arrayMove(steps, oldIndex, newIndex)
    setSteps(newSteps)
    persistOrder(newSteps)
  }

  function handleMoveUp(stepId: string) {
    const index = steps.findIndex(s => s.id === stepId)
    if (index <= 0) return
    const newSteps = arrayMove(steps, index, index - 1)
    setSteps(newSteps)
    persistOrder(newSteps)
  }

  function handleMoveDown(stepId: string) {
    const index = steps.findIndex(s => s.id === stepId)
    if (index >= steps.length - 1) return
    const newSteps = arrayMove(steps, index, index + 1)
    setSteps(newSteps)
    persistOrder(newSteps)
  }

  function handleAddStep() {
    if (!newStepName.trim()) return
    startTransition(async () => {
      const result = await createStep({ projectId, name: newStepName.trim() })
      if (result.success) {
        showSuccessToast('Step added')
        setNewStepName('')
        setAddingStep(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  function handleEditStep(stepId: string) {
    if (!editName.trim()) return
    startTransition(async () => {
      const result = await updateStep({ id: stepId, name: editName.trim() })
      if (result.success) {
        showSuccessToast('Step updated')
        setEditingStepId(null)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  function handleDeleteStep() {
    if (!deleteStepId) return
    startTransition(async () => {
      const result = await deleteStep(deleteStepId)
      if (result.success) {
        showSuccessToast('Step deleted')
        setDeleteStepId(null)
      } else {
        showErrorToast(result.error)
        setDeleteStepId(null)
      }
    })
  }

  function handleStateChange(stepId: string, newState: StepState) {
    startTransition(async () => {
      const result = await updateStepState({ id: stepId, state: newState })
      if (result.success) {
        showSuccessToast('Step ' + (newState === 'COMPLETED' ? 'completed' : 'started'))
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <SortableStepItem
                key={step.id}
                step={step}
                index={index}
                total={steps.length}
                isCompleted={isCompleted}
                editingStepId={editingStepId}
                editName={editName}
                setEditName={setEditName}
                isPending={isPending}
                onEditStep={handleEditStep}
                onCancelEdit={() => setEditingStepId(null)}
                onStartEdit={(id, name) => { setEditingStepId(id); setEditName(name) }}
                onDeleteStep={(id) => setDeleteStepId(id)}
                onStateChange={handleStateChange}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!isCompleted && (
        addingStep ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); handleAddStep() }}
          >
            <Input
              placeholder="Step name"
              value={newStepName}
              onChange={(e) => setNewStepName(e.target.value)}
              maxLength={200}
              autoFocus
            />
            <Button type="submit" disabled={!newStepName.trim() || isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setAddingStep(false); setNewStepName('') }}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button variant="outline" className="w-full min-h-[44px]" onClick={() => setAddingStep(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Step
          </Button>
        )
      )}

      <ConfirmDialog
        open={!!deleteStepId}
        onOpenChange={(v) => { if (!v) setDeleteStepId(null) }}
        title="Delete this step?"
        description="Notes, blockers, and images on this step will be removed."
        onConfirm={handleDeleteStep}
        loading={isPending}
      />
    </div>
  )
}
