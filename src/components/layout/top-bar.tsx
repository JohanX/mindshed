'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Lightbulb, Package, Settings } from 'lucide-react'
import { BrainIcon } from '@/components/icons/brain-icon'
import { cn } from '@/lib/utils'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { getHobbyContext } from '@/lib/hobby-utils'
import { getContrastTextColor } from '@/lib/hobby-color'
import { HobbyFormDialog } from '@/components/hobby/hobby-form'
import { ThemeToggle } from '@/components/theme-toggle'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

interface TopBarProps {
  hobbies: HobbyWithCounts[]
}

const TAGLINES = [
  'keep track of the chaos',
  'organise passion',
  'chaos organised',
  'where was I?',
]

export function TopBar({ hobbies }: TopBarProps) {
  const pathname = usePathname()
  const activeHobby = getHobbyContext(pathname, hobbies)
  const bgColor = activeHobby ? activeHobby.color : 'var(--navbar)'
  const textColor = activeHobby ? getContrastTextColor(activeHobby.color) : 'var(--navbar-foreground)'
  const [tagline, setTagline] = useState(TAGLINES[0])
  useEffect(() => {
    // Pick a random tagline once on mount; SSR + first client render both use TAGLINES[0] to avoid hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTagline(TAGLINES[Math.floor(Math.random() * TAGLINES.length)])
  }, [])

  return (
    <header
      className="hidden lg:flex fixed top-0 left-0 right-0 z-50 h-16 items-center border-b border-transparent"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div className="relative flex items-center justify-between w-full px-6">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0"
          style={{ color: textColor }}
        >
          <BrainIcon className="h-7 w-7 shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight">MindShed</span>
            <span className="text-[10px] font-normal opacity-70 tracking-wide">{tagline}</span>
          </div>
        </Link>

        {/* Center: Dashboard + Hobby links */}
        <nav className="flex items-center gap-1 min-w-0 overflow-x-auto">
          <Link
            href="/"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity min-h-[44px] shrink-0',
              pathname === '/' && !activeHobby ? 'bg-white/20 opacity-100' : 'opacity-80 hover:opacity-100',
            )}
            style={{ color: textColor }}
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
              style: activeHobby
                ? { color: textColor }
                : { color: 'white', opacity: isActive ? 1 : 0.7 },
            })

            return (
              <Link
                key={hobby.id}
                href={`/hobbies/${hobby.id}`}
                title={hobby.name}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg transition-opacity min-h-[44px] shrink-0',
                  compact ? 'px-2 py-2 min-w-[44px] justify-center' : 'px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-white/20 font-semibold opacity-100' : 'opacity-70 hover:opacity-100',
                )}
                style={{ color: textColor }}
              >
                {iconElement || (
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: activeHobby ? textColor : hobby.color,
                      opacity: isActive ? 1 : 0.6,
                    }}
                  />
                )}
                {!compact && <span className="truncate max-w-[120px]">{hobby.name}</span>}
              </Link>
            )
          })}

          {/* Add Hobby */}
          <HobbyFormDialog />
        </nav>

        {/* Right: Ideas + Inventory + Settings */}
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/inventory"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity min-h-[44px]',
              pathname.startsWith('/inventory') && !activeHobby ? 'bg-white/20 opacity-100' : 'opacity-80 hover:opacity-100',
            )}
            style={{ color: textColor }}
          >
            <Package className="h-4 w-4" />
            <span>Inventory</span>
          </Link>
          <Link
            href="/ideas"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity min-h-[44px]',
              pathname.startsWith('/ideas') && !activeHobby ? 'bg-white/20 opacity-100' : 'opacity-80 hover:opacity-100',
            )}
            style={{ color: textColor }}
          >
            <Lightbulb className="h-4 w-4" />
            <span>Ideas</span>
          </Link>
          <div className="opacity-80 hover:opacity-100 transition-opacity" style={{ color: textColor }}>
            <ThemeToggle />
          </div>
          <Link
            href="/settings"
            className={cn(
              'flex items-center px-2 py-2 rounded-lg transition-opacity min-h-[44px] min-w-[44px] justify-center',
              pathname.startsWith('/settings') && !activeHobby ? 'bg-white/20 opacity-100' : 'opacity-80 hover:opacity-100',
            )}
            style={{ color: textColor }}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  )
}
