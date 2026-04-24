'use client'

interface HobbyOption {
  id: string
  name: string
  color: string
}

interface HobbyToggleChipsProps {
  hobbies: HobbyOption[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function HobbyToggleChips({ hobbies, selectedIds, onToggle }: HobbyToggleChipsProps) {
  if (hobbies.length === 0) return null

  return (
    <div className="space-y-1.5" role="group" aria-label="Hobbies">
      <span className="text-sm font-medium">Hobbies</span>
      <div className="flex flex-wrap gap-2">
        {hobbies.map((hobby) => {
          const selected = selectedIds.includes(hobby.id)
          return (
            <button
              key={hobby.id}
              type="button"
              role="switch"
              aria-checked={selected}
              className="min-h-[44px] rounded-full px-3 py-1 text-sm font-medium transition-colors"
              style={
                selected
                  ? { backgroundColor: hobby.color, color: 'white' }
                  : { border: `1.5px solid ${hobby.color}`, color: hobby.color }
              }
              onClick={() => onToggle(hobby.id)}
            >
              {hobby.name}
            </button>
          )
        })}
      </div>
      {selectedIds.length === 0 && (
        <p className="text-xs text-muted-foreground">Leave empty = visible in all hobbies</p>
      )}
    </div>
  )
}
