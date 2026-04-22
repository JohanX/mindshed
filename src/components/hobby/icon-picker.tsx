'use client'

import { HOBBY_ICONS, HOBBY_ICON_OPTIONS } from '@/lib/hobby-icons'
import { cn } from '@/lib/utils'

interface IconPickerProps {
  value: string | null
  onChange: (icon: string | null) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-7 gap-2">
      <button
        type="button"
        title="No icon"
        aria-label="No icon"
        onClick={() => onChange(null)}
        className={cn(
          'min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center border transition-all text-sm text-muted-foreground',
          value === null && 'ring-2 ring-offset-2 ring-foreground',
        )}
      >
        None
      </button>
      {HOBBY_ICON_OPTIONS.map((name) => {
        const Icon = HOBBY_ICONS[name]
        const isSelected = value === name
        return (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            onClick={() => onChange(name)}
            className={cn(
              'min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center border transition-all',
              isSelected && 'ring-2 ring-offset-2 ring-foreground bg-accent',
            )}
          >
            <Icon
              className={cn('h-5 w-5', isSelected ? 'text-foreground' : 'text-muted-foreground')}
            />
          </button>
        )
      })}
    </div>
  )
}
