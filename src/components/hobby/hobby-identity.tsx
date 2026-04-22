import { cn } from '@/lib/utils'
import { renderHobbyIcon } from '@/lib/hobby-icons'

type HobbyIdentityProps = {
  hobby: {
    name: string
    color: string
    icon: string | null
  }
  variant: 'dot' | 'badge' | 'accent' | 'full'
  className?: string
  children?: React.ReactNode
}

export function HobbyIdentity({ hobby, variant, className, children }: HobbyIdentityProps) {
  switch (variant) {
    case 'dot':
      return (
        <span
          className={cn('inline-block w-2 h-2 rounded-full shrink-0', className)}
          style={{ backgroundColor: hobby.color }}
          aria-hidden="true"
        />
      )

    case 'badge':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-sm text-muted-foreground',
            className,
          )}
        >
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: hobby.color }}
            aria-hidden="true"
          />
          {hobby.name}
        </span>
      )

    case 'accent':
      return (
        <div className={cn('border-l-4', className)} style={{ borderLeftColor: hobby.color }}>
          {children}
        </div>
      )

    case 'full': {
      const iconElement = renderHobbyIcon(hobby.icon, {
        className: 'h-5 w-5',
        style: { color: hobby.color },
      })
      return (
        <div className={cn('flex items-center gap-2', className)}>
          {iconElement ? (
            iconElement
          ) : (
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: hobby.color }}
              aria-hidden="true"
            />
          )}
          <span className="text-lg font-medium">{hobby.name}</span>
        </div>
      )
    }
  }
}
