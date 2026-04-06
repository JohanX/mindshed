import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { HobbyIdentity } from './hobby-identity'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

interface HobbyCardProps {
  hobby: HobbyWithCounts
}

export function HobbyCard({ hobby }: HobbyCardProps) {
  return (
    <Link href={`/hobbies/${hobby.id}`} className="block">
      <HobbyIdentity hobby={hobby} variant="accent">
        <Card className="border-0 ring-0 rounded-none">
          <CardContent className="flex items-center justify-between">
            <HobbyIdentity hobby={hobby} variant="full" />
            <span className="text-sm text-muted-foreground">
              {hobby.projectCount} {hobby.projectCount === 1 ? 'project' : 'projects'}
            </span>
          </CardContent>
        </Card>
      </HobbyIdentity>
    </Link>
  )
}
