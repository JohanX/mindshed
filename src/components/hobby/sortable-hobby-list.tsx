'use client'

import { useState, useRef, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { HobbyCard } from './hobby-card'
import { reorderHobbies } from '@/actions/hobby'
import { showErrorToast } from '@/lib/toast'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

interface SortableHobbyListProps {
  hobbies: HobbyWithCounts[]
}

function SortableItem({ hobby }: { hobby: HobbyWithCounts }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: hobby.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    // Story 34.3 / FR130 — handle is rendered INSIDE HobbyCard at the
    // leftmost edge (absolute-positioned, mirroring the meatball menu on
    // the right). The sibling-of-card flex column with `gap-2` is gone.
    // `useSortable`'s attributes + listeners thread through the card's
    // `dragHandle` prop. `touch-none select-none` posture is preserved
    // verbatim from Story 32.1 inside the card's handle button.
    <div ref={setNodeRef} style={style}>
      <HobbyCard hobby={hobby} dragHandle={{ attributes, listeners }} />
    </div>
  )
}

export function SortableHobbyList({ hobbies: initialHobbies }: SortableHobbyListProps) {
  const [hobbies, setHobbies] = useState(initialHobbies)
  const lastConfirmedOrderRef = useRef(initialHobbies)
  const [, startTransition] = useTransition()

  // PointerSensor: desktop mouse drag — instant activation on 5-px move.
  // TouchSensor: mobile finger drag — 250 ms long-press hold with up to
  // 5 px tolerance during the hold (Story 32.1).
  // KeyboardSensor: a11y reorder via Space + Arrow keys.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function persistOrder(newHobbies: HobbyWithCounts[]) {
    startTransition(async () => {
      const result = await reorderHobbies({
        orderedIds: newHobbies.map((hobby) => hobby.id),
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

    const oldIndex = hobbies.findIndex((hobby) => hobby.id === active.id)
    const newIndex = hobbies.findIndex((hobby) => hobby.id === over.id)
    const newHobbies = arrayMove(hobbies, oldIndex, newIndex)
    setHobbies(newHobbies)
    persistOrder(newHobbies)
  }

  return (
    <DndContext
      id="sortable-hobby-list"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={hobbies.map((hobby) => hobby.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {hobbies.map((hobby) => (
            <SortableItem key={hobby.id} hobby={hobby} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
