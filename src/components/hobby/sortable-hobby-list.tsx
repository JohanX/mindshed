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
import { GripVertical } from 'lucide-react'
import { HobbyCard } from './hobby-card'
import { reorderHobbies } from '@/actions/hobby'
import { showErrorToast } from '@/lib/toast'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

interface SortableHobbyListProps {
  hobbies: HobbyWithCounts[]
}

function SortableItem({ hobby }: { hobby: HobbyWithCounts }) {
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
      <button
        className="hidden sm:flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={hobbies.map(h => h.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {hobbies.map((hobby) => (
            <SortableItem key={hobby.id} hobby={hobby} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
