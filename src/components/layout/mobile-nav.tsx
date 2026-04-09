'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Palette, Lightbulb, Settings, ArrowLeft, FolderOpen, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getHobbyContext } from '@/lib/hobby-utils'
import { getContrastTextColor } from '@/lib/hobby-color'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

const DEFAULT_NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hobbies', label: 'Hobbies', icon: Palette },
  { href: '/ideas', label: 'Ideas', icon: Lightbulb },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface MobileNavProps {
  hobbies: HobbyWithCounts[]
}

export function MobileNav({ hobbies }: MobileNavProps) {
  const pathname = usePathname()
  const activeHobby = getHobbyContext(pathname, hobbies)

  if (activeHobby) {
    const textColor = getContrastTextColor(activeHobby.color)
    const contextItems = [
      { href: '/hobbies', label: 'Hobbies', icon: ArrowLeft },
      { href: `/hobbies/${activeHobby.id}`, label: 'Projects', icon: FolderOpen },
      { href: `/hobbies/${activeHobby.id}/ideas`, label: 'Ideas', icon: Lightbulb },
      { href: `/settings`, label: 'More', icon: MoreHorizontal },
    ]

    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t-0 lg:hidden"
        style={{ backgroundColor: activeHobby.color, color: textColor }}
      >
        <div className="flex items-center justify-around h-16">
          {contextItems.map((item) => {
            const isActive = item.href === `/hobbies/${activeHobby.id}`
              ? pathname === item.href
              : item.href === '/hobbies'
                ? false  // Back link is never "active"
                : pathname.startsWith(item.href) && item.href !== '/settings'
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-medium transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100',
                )}
                style={{ color: textColor }}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  // Default navigation
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card lg:hidden">
      <div className="flex items-center justify-around h-16">
        {DEFAULT_NAV_ITEMS.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
