'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

const NOOP_SUBSCRIBE = () => () => {}
function useIsMounted() {
  // Returns false during SSR, true after client mount. Avoids the
  // `setState-in-effect` lint rule that fires on the equivalent
  // useState+useEffect pattern.
  return useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => true,
    () => false,
  )
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  // next-themes can't read the persisted theme during SSR, so the
  // server renders no `border-primary` highlight and the client renders
  // it on whichever button matches the resolved theme. Defer the
  // selected-state classes until after mount so the initial render
  // matches the server output. The buttons stay clickable throughout.
  const mounted = useIsMounted()

  return (
    <div className="flex gap-2">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors min-h-[44px]',
            mounted && theme === value
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}
