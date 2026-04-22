'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import type { ActionResult } from '@/lib/action-result'
import { idleThresholdSchema, SETTING_KEY_IDLE_THRESHOLD_DAYS } from '@/lib/schemas/settings'
import { getIdleThresholdDays } from '@/lib/settings'

export async function getIdleThreshold(): Promise<ActionResult<{ days: number }>> {
  try {
    return { success: true, data: { days: await getIdleThresholdDays() } }
  } catch (error) {
    console.error('getIdleThreshold failed:', error)
    return { success: false, error: 'Failed to load idle threshold.' }
  }
}

export async function updateIdleThreshold(input: {
  days: number
}): Promise<ActionResult<{ days: number }>> {
  const parsed = idleThresholdSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    await prisma.setting.upsert({
      where: { key: SETTING_KEY_IDLE_THRESHOLD_DAYS },
      update: { value: String(parsed.data.days) },
      create: { key: SETTING_KEY_IDLE_THRESHOLD_DAYS, value: String(parsed.data.days) },
    })
    revalidatePath('/')
    revalidatePath('/hobbies')
    revalidatePath('/settings')
    return { success: true, data: { days: parsed.data.days } }
  } catch (error) {
    console.error('updateIdleThreshold failed:', error)
    return { success: false, error: 'Failed to update idle threshold. Please try again.' }
  }
}
