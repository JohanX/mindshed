import { toast } from 'sonner'

/**
 * Defer window for `deferredSuccessToast`. 100ms is enough to let any
 * concurrent Radix Dialog exit animation, focus restoration, and (on iOS
 * Safari) soft-keyboard dismissal complete BEFORE the toast portal becomes
 * the top focus target. Without this defer, sonner's hover/focus pause-on-
 * focus behaviour can latch the toast in a paused state on touch devices
 * (no `mouseleave` to undo the pause) — the toast appears, the timer pauses,
 * the toast lingers indefinitely. See Story 30.2 / FR126 / GH #1.
 */
export const TOAST_SUCCESS_DEFER_MS = 100

/**
 * Show a success toast — auto-dismisses after 3 seconds.
 * Message should be under 8 words and action-oriented.
 * Examples: "Hobby created", "Step completed", "Photo added"
 */
export function showSuccessToast(message: string) {
  toast.success(message, { duration: 3000 })
}

/**
 * Show a success toast deferred by `TOAST_SUCCESS_DEFER_MS`. Use this
 * variant when the toast follows immediately after closing a Radix Dialog
 * / Drawer / Popover — the defer prevents the iOS-Safari focus-pause race
 * that traps the toast in sonner's pause state. Closes Story 30.2 / GH #1.
 *
 * Migration note: gradually replace the `showSuccessToast(...) → close
 * dialog` ordering across the app with `close dialog → deferredSuccessToast`.
 * Forms known to follow this pattern: hobby-form, inventory-item-form,
 * idea-form, project-create-dialog, blocker-form, BOM dialogs.
 */
export function deferredSuccessToast(message: string) {
  setTimeout(() => showSuccessToast(message), TOAST_SUCCESS_DEFER_MS)
}

/**
 * Show an error toast — stays for 5 seconds, dismissible.
 * Message should tell the user what to do, not just what went wrong.
 * Examples: "Upload failed — try again", "Could not save — check connection"
 */
export function showErrorToast(message: string) {
  toast.error(message, { duration: 5000, closeButton: true })
}

/**
 * Show a neutral informational toast — 3 seconds.
 * Use for benign no-ops where success/error framing would be misleading.
 * Examples: "Already blocked on Step Prep."
 */
export function showInfoToast(message: string) {
  toast(message, { duration: 3000 })
}
