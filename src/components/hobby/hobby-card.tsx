'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { HobbyIdentity } from './hobby-identity'
import { HobbyFormDialog } from './hobby-form'
import { MoreHorizontal, Pencil } from 'lucide-react'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

interface HobbyCardProps {
  hobby: HobbyWithCounts
}

export function HobbyCard({ hobby }: HobbyCardProps) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <div className="relative">
        <Link href={`/hobbies/${hobby.id}`} className="block">
          <HobbyIdentity hobby={hobby} variant="accent">
            <Card className="border-0 ring-0 rounded-none">
              <CardContent className="flex items-center justify-between pr-12">
                <HobbyIdentity hobby={hobby} variant="full" />
                <span className="text-sm text-muted-foreground">
                  {hobby.projectCount} {hobby.projectCount === 1 ? 'project' : 'projects'}
                </span>
              </CardContent>
            </Card>
          </HobbyIdentity>
        </Link>
        <div className="absolute top-1/2 right-2 -translate-y-1/2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Hobby actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <HobbyFormDialog
        hobby={hobby}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}
