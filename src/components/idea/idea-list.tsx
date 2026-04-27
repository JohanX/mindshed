'use client'

import type { IdeaWithThumbnail } from '@/actions/idea'
import { IdeaCard, type IdeaCardHobby } from '@/components/idea/idea-card'

interface IdeaListProps {
  ideas: IdeaWithThumbnail[]
  hobby: IdeaCardHobby
}

export function IdeaList({ ideas, hobby }: IdeaListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} hobby={hobby} showHobbyBadge={false} />
      ))}
    </div>
  )
}
