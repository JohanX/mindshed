import { TopBar } from '@/components/layout/top-bar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { getHobbies } from '@/actions/hobby'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const result = await getHobbies()
  const hobbies = result.success ? result.data : []

  return (
    <>
      <TopBar hobbies={hobbies} />
      <main className="pt-0 lg:pt-16 pb-20 lg:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <MobileNav hobbies={hobbies} />
    </>
  )
}
