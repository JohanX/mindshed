import { HobbyCard } from './hobby-card'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

interface HobbyListProps {
  hobbies: HobbyWithCounts[]
}

export function HobbyList({ hobbies }: HobbyListProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {hobbies.map((hobby) => (
        <HobbyCard key={hobby.id} hobby={hobby} />
      ))}
    </div>
  )
}
