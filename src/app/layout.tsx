import type { Metadata, Viewport } from 'next'
import { MotionConfig } from 'motion/react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ViewportInsetTracker } from '@/components/layout/viewport-inset-tracker'
import './globals.css'

// Story 30.4 / FR128: `metadataBase` lets relative `og:image` / canonical
// fields (and any future programmatic OG routes) compose into absolute URLs
// at build time. Source-of-truth chain:
//   NEXT_PUBLIC_SITE_URL  →  https://${VERCEL_URL}  →  http://localhost:3000
// VERCEL_URL is auto-set on Vercel deploys (each preview gets a unique URL).
// NEXT_PUBLIC_SITE_URL is the override for a custom production domain.
//
// Defensive: invalid input (empty string, missing scheme, garbage) would
// throw from `new URL(...)` at module-load and crash the WHOLE root layout
// — meaning every route in the app would 500 at boot. We try the configured
// chain, and on failure log + fall back to localhost so the app stays up.
function resolveMetadataBase(): URL {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  try {
    return new URL(candidate)
  } catch {
    console.warn(
      `[metadata] Invalid base URL ${JSON.stringify(candidate)} — falling back to http://localhost:3000`,
    )
    return new URL('http://localhost:3000')
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
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
          {/* Story 32.3: MotionConfig with reducedMotion="user" makes
              every Framer Motion surface in the app honour the
              `prefers-reduced-motion: reduce` media query at the
              library level (collapses transitions to 0 duration,
              neutralises layout/spring motion). The
              `useMotionTokens()` hook from Story 32.2 redundantly
              checks the same preference for surfaces that need the
              duration values directly. */}
          <MotionConfig reducedMotion="user">
            <ViewportInsetTracker />
            {children}
            <Toaster />
          </MotionConfig>
        </ThemeProvider>
      </body>
    </html>
  )
}
