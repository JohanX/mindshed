import type { Metadata } from 'next'
import { TopBar } from '@/components/layout/top-bar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Toaster } from '@/components/ui/sonner'
import { getHobbies } from '@/actions/hobby'
import './globals.css'

export const metadata: Metadata = {
  title: 'MindShed',
  description: 'A hobby project tracker for crafters and makers',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const result = await getHobbies()
  const hobbies = result.success ? result.data : []

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <TopBar hobbies={hobbies} />
        <main className="pt-0 lg:pt-16 pb-20 lg:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <MobileNav hobbies={hobbies} />
        <Toaster />
      </body>
    </html>
  )
}
