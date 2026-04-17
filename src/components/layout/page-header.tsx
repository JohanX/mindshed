import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import React from 'react'

export interface BreadcrumbSegment {
  label: string
  href?: string
  hobbyColor?: string
}

interface PageHeaderProps {
  title: string
  breadcrumbs?: BreadcrumbSegment[]
  children?: React.ReactNode
}

export function PageHeader({ title, breadcrumbs, children }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.map((segment, index) => (
              <React.Fragment key={segment.label}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage className="inline-flex items-center gap-1.5">
                      {segment.hobbyColor && (
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: segment.hobbyColor }}
                          aria-hidden="true"
                        />
                      )}
                      {segment.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={segment.href ?? '#'} className="inline-flex items-center gap-1.5">
                      {segment.hobbyColor && (
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: segment.hobbyColor }}
                          aria-hidden="true"
                        />
                      )}
                      {segment.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  )
}
