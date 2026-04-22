import Link from 'next/link'

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-foreground">
          MindShed
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        Made with MindShed
      </footer>
    </div>
  )
}
