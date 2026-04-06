'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createProject } from '@/actions/project'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, Loader2, X } from 'lucide-react'

interface ProjectCreateDialogProps {
  hobbyId: string
}

export function ProjectCreateDialog({ hobbyId }: ProjectCreateDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nextStepId, setNextStepId] = useState(1)
  const [steps, setSteps] = useState([{ id: 0, name: '' }])
  const [isPending, startTransition] = useTransition()

  const isValid = name.trim().length > 0 && steps.length > 0 && steps.every(s => s.name.trim().length > 0)

  function resetForm() {
    setName('')
    setDescription('')
    setSteps([{ id: 0, name: '' }])
    setNextStepId(1)
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen)
    if (!newOpen) resetForm()
  }

  function addStep() {
    setSteps([...steps, { id: nextStepId, name: '' }])
    setNextStepId(nextStepId + 1)
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return
    setSteps(steps.filter((_, i) => i !== index))
  }

  function updateStep(index: number, value: string) {
    setSteps(steps.map((s, i) => i === index ? { ...s, name: value } : s))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    startTransition(async () => {
      const result = await createProject({
        name: name.trim(),
        description: description.trim() || null,
        hobbyId,
        steps: steps.map(s => ({ name: s.name.trim() })),
      })

      if (result.success) {
        showSuccessToast('Project created')
        handleOpenChange(false)
        router.push(`/hobbies/${result.data.hobbyId}/projects/${result.data.id}`)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g., Walnut Side Table"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <Label htmlFor="project-description">Description</Label>
              <span className="text-xs text-muted-foreground">optional</span>
            </div>
            <Textarea
              id="project-description"
              placeholder="What are you making?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <Label>Steps</Label>
              <span className="text-xs text-muted-foreground">define your workflow</span>
            </div>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 text-right shrink-0">{index + 1}.</span>
                  <Input
                    placeholder={`Step ${index + 1} name`}
                    value={step.name}
                    onChange={(e) => updateStep(index, e.target.value)}
                    maxLength={200}
                  />
                  {steps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 min-h-[44px] min-w-[44px]"
                      onClick={() => removeStep(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {steps.length < 50 && (
                <Button type="button" variant="outline" onClick={addStep} className="w-full min-h-[44px]">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Step
                </Button>
              )}
            </div>
          </div>

          <div className="relative group">
            <Button
              type="submit"
              disabled={!isValid || isPending}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Save'
              )}
            </Button>
            {!isValid && !isPending && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-card border border-border rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {name.trim().length === 0 ? 'Enter a project name' : 'All steps need names'}
              </span>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
