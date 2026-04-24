'use client'

import { HOBBY_COLORS } from '@/lib/schemas/hobby'
import { cn } from '@/lib/utils'
import { getContrastTextColor } from '@/lib/hobby-color'
import { Check } from 'lucide-react'

interface ColorPickerProps {
  value: string | null
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {HOBBY_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          title={color.name}
          onClick={() => onChange(color.value)}
          className={cn(
            'min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center transition-all',
            value === color.value && 'ring-2 ring-offset-2 ring-foreground',
          )}
          style={{ backgroundColor: color.value }}
        >
          {value === color.value && <Check className="h-5 w-5 drop-shadow-sm" style={{ color: getContrastTextColor(color.value) }} />}
        </button>
      ))}
    </div>
  )
}
