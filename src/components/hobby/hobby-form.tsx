'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ColorPicker } from './color-picker'
import { IconPicker } from './icon-picker'
import { createHobby, updateHobby } from '@/actions/hobby'
import { HOBBY_COLORS } from '@/lib/schemas/hobby'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, Loader2 } from 'lucide-react'

type HobbyData = {
  id: string
  name: string
  color: string
  icon: string | null
}

type HobbyFormDialogProps = {
  hobby?: HobbyData
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function HobbyFormDialog({
  hobby,
  open: controlledOpen,
  onOpenChange,
}: HobbyFormDialogProps) {
  const isEditMode = !!hobby
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen

  const [name, setName] = useState(hobby?.name ?? '')
  const [color, setColor] = useState<string | null>(hobby?.color ?? HOBBY_COLORS[0].value)
  const [icon, setIcon] = useState<string | null>(hobby?.icon ?? null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(newOpen: boolean) {
    if (newOpen && hobby) {
      setName(hobby.name)
      setColor(hobby.color)
      setIcon(hobby.icon)
    }
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setInternalOpen(newOpen)
    }
    if (!newOpen && !isEditMode) {
      resetForm()
    }
  }

  const isValid = name.trim().length > 0 && color !== null

  function resetForm() {
    if (!isEditMode) {
      setName('')
      setColor(HOBBY_COLORS[0].value)
      setIcon(null)
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!isValid || !color) return

    startTransition(async () => {
      if (isEditMode && hobby) {
        const result = await updateHobby({
          id: hobby.id,
          name: name.trim(),
          color,
          icon,
        })
        if (result.success) {
          showSuccessToast('Hobby updated')
          handleOpenChange(false)
        } else {
          showErrorToast(result.error)
        }
      } else {
        const result = await createHobby({
          name: name.trim(),
          color,
          icon,
        })
        if (result.success) {
          showSuccessToast('Hobby created')
          handleOpenChange(false)
        } else {
          showErrorToast(result.error)
        }
      }
    })
  }

  const dialogContent = (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Edit Hobby' : 'Create a new hobby'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label htmlFor="hobby-name">Name</Label>
          <Input
            id="hobby-name"
            placeholder="e.g., Woodworking"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <Label>Color</Label>
            <span className="text-xs text-muted-foreground">Pick a color for your hobby</span>
          </div>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <Label>Icon</Label>
            <span className="text-xs text-muted-foreground">optional</span>
          </div>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div className="relative group">
          <Button type="submit" disabled={!isValid || isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditMode ? 'Saving...' : 'Creating...'}
              </>
            ) : (
              'Save'
            )}
          </Button>
          {!isValid && !isPending && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-card border border-border rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {name.trim().length === 0 ? 'Enter a hobby name' : 'Select a color to continue'}
            </span>
          )}
        </div>
      </form>
    </DialogContent>
  )

  if (isEditMode) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {dialogContent}
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Hobby
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  )
}
