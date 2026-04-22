'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createStep } from '@/actions/step'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, Loader2 } from 'lucide-react'

interface AddStepFormProps {
  projectId: string
}

export function AddStepForm({ projectId }: AddStepFormProps) {
  const [newStepName, setNewStepName] = useState('')
  const [adding, setAdding] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    if (!newStepName.trim()) return
    startTransition(async () => {
      const result = await createStep({ projectId, name: newStepName.trim() })
      if (result.success) {
        showSuccessToast('Step added')
        setNewStepName('')
        setAdding(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  if (adding) {
    return (
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); handleAdd() }}
      >
        <Input
          placeholder="Step name"
          value={newStepName}
          onChange={(e) => setNewStepName(e.target.value)}
          maxLength={200}
          autoFocus
        />
        <Button type="submit" className="min-h-[44px]" disabled={!newStepName.trim() || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
        </Button>
        <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => { setAdding(false); setNewStepName('') }}>
          Cancel
        </Button>
      </form>
    )
  }

  return (
    <Button variant="outline" className="w-full min-h-[44px]" onClick={() => setAdding(true)}>
      <Plus className="h-4 w-4 mr-1" />
      Add Step
    </Button>
  )
}
