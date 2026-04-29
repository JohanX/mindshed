import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'MindShed',
  description: 'A hobby project tracker for crafters and makers',
}

// Story 26.1: `interactiveWidget: 'resizes-content'` tells iOS Safari /
// Chrome to resize the *layout* viewport (not just the visual one) when
// the soft keyboard appears. Without this, `position: fixed` overlays
// stay anchored to the full layout height and their bottom edge sits
// permanently behind the keyboard — so even with `overflow-y-auto` on
// the dialog overlay (the shadcn-ui#16 pattern) the user can't scroll
// the dialog's bottom into the visible area above the keyboard. With
// it, `inset-0` / `100dvh` shrink to match the visible area, scroll
// works as expected, and the bottom-anchored mobile nav repositions
// above the keyboard instead of being obscured by it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
