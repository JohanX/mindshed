import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface EmptyStateCardProps {
  message: string
  children?: React.ReactNode
  className?: string
}

export function EmptyStateCard({ message, children, className }: EmptyStateCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <p className="text-muted-foreground text-base">{message}</p>
        {children}
      </CardContent>
    </Card>
  )
}
