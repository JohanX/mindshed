'use client'

import { useEffect } from 'react'

/**
 * Story 26.1: tracks the iOS soft keyboard inset via the visualViewport
 * API and exposes it as the CSS custom property `--kb-inset` on
 * `<html>`. Consumers (notably the dialog overlay and the bottom-fixed
 * mobile nav) can use `var(--kb-inset, 0px)` to position themselves
 * above the keyboard.
 *
 * The Next 16 viewport hint `interactiveWidget: 'resizes-content'` is
 * supposed to make iOS resize the layout viewport when the keyboard
 * appears, but as of iOS 18 Safari/Chrome ignore it in practice — so
 * we drive the inset from JS instead. visualViewport is supported on
 * iOS 13+ and all modern browsers; on browsers without it the inset
 * stays 0 and behaviour is unchanged from the desktop default.
 */
export function ViewportInsetTracker() {
  useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return

    const update = () => {
      // Keyboard inset = the portion of the layout viewport hidden
      // beneath the keyboard. visualViewport.offsetTop accounts for
      // the URL bar / pinch-zoom offset on iOS.
      const inset = Math.max(
        0,
        window.innerHeight - visualViewport.height - visualViewport.offsetTop,
      )
      document.documentElement.style.setProperty('--kb-inset', `${inset}px`)
    }

    update()
    visualViewport.addEventListener('resize', update)
    visualViewport.addEventListener('scroll', update)
    return () => {
      visualViewport.removeEventListener('resize', update)
      visualViewport.removeEventListener('scroll', update)
    }
  }, [])

  return null
}
