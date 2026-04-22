import type { HobbyWithCounts } from '@/lib/schemas/hobby'

export function getHobbyContext(pathname: string, hobbies: HobbyWithCounts[]) {
  const match = pathname.match(/^\/hobbies\/([^/]+)/)
  if (!match) return null
  return hobbies.find((h) => h.id === match[1]) ?? null
}
