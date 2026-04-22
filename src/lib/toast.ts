import { toast } from 'sonner'

/**
 * Show a success toast — auto-dismisses after 3 seconds.
 * Message should be under 8 words and action-oriented.
 * Examples: "Hobby created", "Step completed", "Photo added"
 */
export function showSuccessToast(message: string) {
  toast.success(message, { duration: 3000 })
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
