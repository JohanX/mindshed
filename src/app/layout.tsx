import type { Metadata } from 'next'
import { MobileNav } from '@/components/layout/mobile-nav'
import { NavSidebar } from '@/components/layout/nav-sidebar'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'MindShed',
  description: 'A hobby project tracker for crafters and makers',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <NavSidebar />
        <main className="lg:pl-60 pb-20 lg:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <MobileNav />
        <Toaster />
      </body>
    </html>
  )
}
