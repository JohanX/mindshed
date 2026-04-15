import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { generateHobbyStyleVars } from '@/lib/hobby-color'

interface HobbyLayoutProps {
  children: React.ReactNode
  params: Promise<{ hobbyId: string }>
}

export default async function HobbyLayout({ children, params }: HobbyLayoutProps) {
  const { hobbyId } = await params
  const hobby = await prisma.hobby.findUnique({
    where: { id: hobbyId },
    select: { id: true, color: true, name: true },
  })

  if (!hobby) notFound()

  const styleVars = generateHobbyStyleVars(hobby.color)

  return (
    <div style={styleVars} data-hobby-context={hobby.id}>
      {children}
    </div>
  )
}
