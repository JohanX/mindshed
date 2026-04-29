import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ViewportInsetTracker } from '@/components/layout/viewport-inset-tracker'
import './globals.css'

export const metadata: Metadata = {
  title: 'MindShed',
  description: 'A hobby project tracker for crafters and makers',
}

// Story 26.1: `interactiveWidget: 'resizes-content'` is the standards-
// track way to make the browser resize the *layout* viewport when the
// soft keyboard appears. Chrome (Android) honours it; iOS Safari /
// Chrome do not in practice as of iOS 18, so we additionally drive a
// CSS `--kb-inset` variable from the visualViewport API (see
// ViewportInsetTracker) and consume it in the dialog overlay. The
// viewport hint is left in place because it costs nothing and helps
// browsers that DO honour it.
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
          <ViewportInsetTracker />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
