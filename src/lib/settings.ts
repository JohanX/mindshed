import { prisma } from '@/lib/db'
import {
  DEFAULT_IDLE_THRESHOLD_DAYS,
  MIN_IDLE_THRESHOLD_DAYS,
  MAX_IDLE_THRESHOLD_DAYS,
  SETTING_KEY_IDLE_THRESHOLD_DAYS,
} from '@/lib/schemas/settings'

export async function getIdleThresholdDays(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY_IDLE_THRESHOLD_DAYS } })
  if (!row) return DEFAULT_IDLE_THRESHOLD_DAYS
  const n = Number.parseInt(row.value, 10)
  if (!Number.isFinite(n) || n < MIN_IDLE_THRESHOLD_DAYS || n > MAX_IDLE_THRESHOLD_DAYS) {
    return DEFAULT_IDLE_THRESHOLD_DAYS
  }
  return n
}
