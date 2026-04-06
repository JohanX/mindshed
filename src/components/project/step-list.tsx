'use client'

import { useState, useTransition } from 'react'
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
import { createStep, updateStep, deleteStep, updateStepState } from '@/actions/step'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, MoreHorizontal, Pencil, Trash2, Check, Play, Loader2 } from 'lucide-react'
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

export function StepList({ steps, projectId, isCompleted }: StepListProps) {
  const [newStepName, setNewStepName] = useState('')
  const [addingStep, setAddingStep] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteStepId, setDeleteStepId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
      {steps.map((step) => (
        <Card key={step.id}>
          <CardContent className="flex items-center justify-between gap-2">
            {editingStepId === step.id ? (
              <form
                className="flex-1 flex gap-2"
                onSubmit={(e) => { e.preventDefault(); handleEditStep(step.id) }}
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
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingStepId(null)}>
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
                      onClick={() => handleStateChange(step.id, 'IN_PROGRESS')}
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
                      onClick={() => handleStateChange(step.id, 'COMPLETED')}
                      title="Mark complete"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <span className="font-medium truncate">{step.name}</span>
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
                        <DropdownMenuItem className="min-h-[44px]" onClick={() => { setEditingStepId(step.id); setEditName(step.name) }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="min-h-[44px] text-destructive" onClick={() => setDeleteStepId(step.id)}>
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
      ))}

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
