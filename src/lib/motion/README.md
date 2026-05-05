# Motion system

Single source of truth for animation in MindShed. **Story 32.2 (Epic 32)** added Framer Motion (`motion/react`) alongside the existing CSS keyframe foundation from Story 29.1.

The two systems coexist by contract:

- **CSS keyframes** in `src/app/globals.css` drive declarative, `data-state`-attribute-controlled surfaces (Radix Dialog, Sonner toast). Already in place.
- **Framer Motion** drives orchestrated motion that CSS keyframes can't express cleanly — layout animations like the lightbox morph from a thumbnail (`layoutId`), gesture-mapped drag, route transitions.

When choosing between the two, ask: _can a `data-state="open"` selector on a known DOM attribute drive this?_ If yes → CSS. If you need to compute the endpoint at runtime (e.g., based on another element's bounding box), or coordinate motion across components → Framer.

## Tokens

`motion-tokens.ts` exports four constants:

- `DURATION` — duration tokens in **seconds** (Framer's unit).
- `EASING` — easing presets including the project's standard cubic-bezier (mirrors `--anim-easing` in CSS).
- `SPRING` — spring presets for physical-feeling motion.
- `transitions` — named transition primitives consumable as `transition={transitions.fade}` etc.

Plus the `useMotionTokens()` hook which returns the same tokens with `prefers-reduced-motion` already applied (durations → 0).

## Cross-system numeric contract

The JS `DURATION` values in seconds match the CSS `--anim-duration-*` values in milliseconds:

| JS token              | CSS counterpart                  | Value  |
| --------------------- | -------------------------------- | ------ |
| `DURATION.quick`      | `--anim-duration-fast`           | 150 ms |
| `DURATION.default`    | `--anim-duration-medium`         | 220 ms |
| `DURATION.deliberate` | `--anim-duration-slow`           | 320 ms |
| `DURATION.instant`    | (reduced-motion fallback)        | 0      |
| `DURATION.slow`       | (JS-only — orchestrated reveals) | 600 ms |

**When you change one, change the other.** A Framer-driven toast next to a CSS-keyframed dialog opening at the same moment is jarring if their durations disagree. The contract is enforced by convention — there's no automated check. Discipline.

## Token taxonomy — when to use what

| Token        | Use for                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `instant`    | Reduced-motion fallback. Don't pick this manually for normal-motion users — `useMotionTokens()` resolves it automatically.                                     |
| `quick`      | Dropdowns, popovers, tooltips, hover/focus state changes. Anything where the user expects "no delay."                                                          |
| `default`    | Dialog open/close, lightbox in/out, toast slide, status badge color shift. The workhorse — most surfaces should pick this.                                     |
| `deliberate` | Route transitions, larger context-switching surfaces (e.g., switching tabs in a multi-pane layout).                                                            |
| `slow`       | Orchestrated, "wow" reveals — multi-step reveals, the lightbox `layoutId` morph from a thumbnail. Use sparingly; over-using `slow` reads as "trying too hard." |

Easing:

- `EASING.standard` — symmetric, project-default. Use for most enter+exit pairs.
- `EASING.easeOut` — emphasises the end of the motion. Good for "settling-in" enters (toast slide-up).
- `EASING.easeInOut` — symmetric ease. Good for state changes that should feel "considered" (status badge color).

Springs:

- `SPRING.gentle` — soft physical bounce, e.g. post-drop settle on a sortable card.
- `SPRING.snappy` — tighter spring, for quick acknowledgements like a button press confirmation.

## `prefers-reduced-motion` contract

Both systems honour the user's preference:

1. **CSS side**: `@media (prefers-reduced-motion: reduce)` in `globals.css` zeroes the `--anim-duration-*` vars and neutralises keyframe transforms.
2. **JS side**: `useMotionTokens()` checks `motion/react`'s `useReducedMotion()` hook and returns `0` durations when the preference is set.
3. **App boundary**: wrap the app shell in `<MotionConfig reducedMotion="user">` so Framer's layout system honours the preference for surfaces that don't go through the hook (Story 32.3 will install this).

## Bundle cost

`motion` v12 ships at ~35 kB gzipped for the full library, but tree-shakes well. A page using only `<motion.div>` + `transition` lands closer to 8-12 kB. The Story 32.5 retrofit will land Framer on a small set of surfaces (lightbox, route transitions, maybe a few status surfaces). Keep the import surface narrow:

```ts
// Good
import { motion, AnimatePresence } from 'motion/react'

// Bad (drags in unused gesture/scroll/path utilities)
import * as motion from 'motion/react'
```

## Examples

Simple fade-in:

```tsx
import { motion } from 'motion/react'
import { transitions } from '@/lib/motion/motion-tokens'

;<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transitions.fade}>
  ...
</motion.div>
```

Layout morph between two surfaces (Story 32.3 lightbox preview):

```tsx
// Thumbnail
<motion.img layoutId={`lightbox-${image.id}`} src={...} />

// Lightbox (rendered conditionally inside <AnimatePresence>)
<AnimatePresence>
  {isOpen && (
    <motion.img layoutId={`lightbox-${image.id}`} src={...} />
  )}
</AnimatePresence>
```

Reduced-motion-safe consumer:

```tsx
import { useMotionTokens } from '@/lib/motion/motion-tokens'

function Drawer({ open }: { open: boolean }) {
  const { transitions } = useMotionTokens()
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: open ? '0%' : '100%' }}
      transition={transitions.slide}
    />
  )
}
```

## See also

- `src/app/globals.css` (lines 140-300) — the existing CSS animation system.
- Stories 32.3 / 32.4 — first consumers of the motion tokens (lightbox).
- Story 32.5 — retrofits dialogs / toasts / status / route transitions onto the tokens.
