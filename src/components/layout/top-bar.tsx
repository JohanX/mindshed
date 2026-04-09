'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Lightbulb, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { getHobbyContext } from '@/lib/hobby-utils'
import { getContrastTextColor } from '@/lib/hobby-color'
import { HobbyFormDialog } from '@/components/hobby/hobby-form'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

interface TopBarProps {
  hobbies: HobbyWithCounts[]
}

export function TopBar({ hobbies }: TopBarProps) {
  const pathname = usePathname()
  const activeHobby = getHobbyContext(pathname, hobbies)
  const inHobby = !!activeHobby
  const textColor = activeHobby ? getContrastTextColor(activeHobby.color) : undefined

  return (
    <header
      className={cn(
        'hidden lg:flex fixed top-0 left-0 right-0 z-50 h-16 items-center border-b',
        inHobby ? 'border-transparent' : 'border-border bg-card',
      )}
      style={inHobby ? { backgroundColor: activeHobby!.color, color: textColor } : undefined}
    >
      <div className="relative flex items-center justify-between w-full px-6">
        {/* Left: Logo */}
        <Link
          href="/"
          className={cn('text-lg font-semibold shrink-0', inHobby ? '' : 'text-foreground')}
          style={inHobby ? { color: textColor } : undefined}
        >
          MindShed
        </Link>

        {/* Center: Dashboard + Hobby links */}
        <nav className="flex items-center gap-1 min-w-0 overflow-x-auto">
          <Link
            href="/"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] shrink-0',
              inHobby
                ? 'opacity-80 hover:opacity-100'
                : pathname === '/'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
            style={inHobby ? { color: textColor } : undefined}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          {/* Hobby links */}
          {hobbies.map((hobby) => {
            const isActive = pathname.startsWith(`/hobbies/${hobby.id}`)
            const compact = hobbies.length >= 7
            const iconElement = renderHobbyIcon(hobby.icon, {
              className: 'h-4 w-4',
              style: inHobby ? { color: textColor } : { color: hobby.color },
            })

            return (
              <Link
                key={hobby.id}
                href={`/hobbies/${hobby.id}`}
                title={hobby.name}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg transition-colors min-h-[44px] shrink-0',
                  compact ? 'px-2 py-2 min-w-[44px] justify-center' : 'px-3 py-2 text-sm font-medium',
                  inHobby
                    ? isActive
                      ? 'bg-white/20 font-semibold'
                      : 'opacity-70 hover:opacity-100'
                    : isActive
                      ? 'bg-accent text-foreground ring-1 ring-foreground/10'
                      : 'text-muted-foreground hover:bg-accent/50',
                )}
                style={inHobby ? { color: textColor } : undefined}
              >
                {iconElement || (
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0"
                    style={inHobby
                      ? { backgroundColor: textColor, opacity: isActive ? 1 : 0.6 }
                      : { backgroundColor: hobby.color }
                    }
                  />
                )}
                {!compact && <span className="truncate max-w-[120px]">{hobby.name}</span>}
              </Link>
            )
          })}

          {/* Add Hobby */}
          <HobbyFormDialog />
        </nav>

        {/* Right: Ideas + Settings */}
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/ideas"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
              inHobby
                ? 'opacity-80 hover:opacity-100'
                : pathname.startsWith('/ideas')
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
            style={inHobby ? { color: textColor } : undefined}
          >
            <Lightbulb className="h-4 w-4" />
            <span>Ideas</span>
          </Link>
          <Link
            href="/settings"
            className={cn(
              'flex items-center px-2 py-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] justify-center',
              inHobby
                ? 'opacity-80 hover:opacity-100'
                : pathname.startsWith('/settings')
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
            style={inHobby ? { color: textColor } : undefined}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  )
}
