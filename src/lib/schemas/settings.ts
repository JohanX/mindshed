import { z } from 'zod/v4'

export const DEFAULT_IDLE_THRESHOLD_DAYS = 30
export const MIN_IDLE_THRESHOLD_DAYS = 1
export const MAX_IDLE_THRESHOLD_DAYS = 365

export const idleThresholdSchema = z.object({
  days: z
    .number()
    .int('Must be a whole number')
    .min(MIN_IDLE_THRESHOLD_DAYS, `Must be at least ${MIN_IDLE_THRESHOLD_DAYS} day`)
    .max(MAX_IDLE_THRESHOLD_DAYS, `Must be at most ${MAX_IDLE_THRESHOLD_DAYS} days`),
})

export type IdleThresholdInput = z.infer<typeof idleThresholdSchema>

export const SETTING_KEY_IDLE_THRESHOLD_DAYS = 'idle_threshold_days'
