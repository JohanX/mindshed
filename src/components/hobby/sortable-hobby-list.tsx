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
import { GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HobbyCard } from './hobby-card'
import { reorderHobbies } from '@/actions/hobby'
import { showErrorToast } from '@/lib/toast'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

interface SortableHobbyListProps {
  hobbies: HobbyWithCounts[]
}

function SortableItem({ hobby, index, total, onMoveUp, onMoveDown }: { hobby: HobbyWithCounts; index: number; total: number; onMoveUp: (id: string) => void; onMoveDown: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: hobby.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      {/* Desktop drag handle */}
      <button
        className="hidden lg:flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
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
          onClick={() => onMoveUp(hobby.id)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          disabled={index === total - 1}
          onClick={() => onMoveDown(hobby.id)}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1">
        <HobbyCard hobby={hobby} />
      </div>
    </div>
  )
}

export function SortableHobbyList({ hobbies: initialHobbies }: SortableHobbyListProps) {
  const [hobbies, setHobbies] = useState(initialHobbies)
  const lastConfirmedOrderRef = useRef(initialHobbies)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function persistOrder(newHobbies: HobbyWithCounts[]) {
    startTransition(async () => {
      const result = await reorderHobbies({
        orderedIds: newHobbies.map(h => h.id),
      })
      if (result.success) {
        lastConfirmedOrderRef.current = newHobbies
      } else {
        showErrorToast(result.error)
        setHobbies(lastConfirmedOrderRef.current)
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = hobbies.findIndex(h => h.id === active.id)
    const newIndex = hobbies.findIndex(h => h.id === over.id)
    const newHobbies = arrayMove(hobbies, oldIndex, newIndex)
    setHobbies(newHobbies)
    persistOrder(newHobbies)
  }

  function handleMoveUp(hobbyId: string) {
    const index = hobbies.findIndex(h => h.id === hobbyId)
    if (index <= 0) return
    const newHobbies = arrayMove(hobbies, index, index - 1)
    setHobbies(newHobbies)
    persistOrder(newHobbies)
  }

  function handleMoveDown(hobbyId: string) {
    const index = hobbies.findIndex(h => h.id === hobbyId)
    if (index >= hobbies.length - 1) return
    const newHobbies = arrayMove(hobbies, index, index + 1)
    setHobbies(newHobbies)
    persistOrder(newHobbies)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={hobbies.map(h => h.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {hobbies.map((hobby, index) => (
            <SortableItem
              key={hobby.id}
              hobby={hobby}
              index={index}
              total={hobbies.length}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
