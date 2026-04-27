'use server'

import { getIdleThresholdDays } from '@/lib/settings'
import type { ActionResult } from '@/lib/action-result'
import type { DashboardData } from '@/lib/schemas/dashboard'
import { findDashboardData } from '@/data/dashboard'

/**
 * Thin wrapper: resolves the idle-threshold setting, delegates to the
 * data layer, wraps in `ActionResult`. The composition logic lives in
 * `src/data/dashboard.ts` per architecture.md § "Data Access Layer".
 */
export async function getDashboardData(): Promise<ActionResult<DashboardData>> {
  try {
    const idleThresholdDate = new Date()
    idleThresholdDate.setDate(idleThresholdDate.getDate() - (await getIdleThresholdDays()))
    const data = await findDashboardData(idleThresholdDate)
    return { success: true, data }
  } catch (error) {
    console.error('getDashboardData failed:', error)
    return { success: false, error: 'Failed to load dashboard' }
  }
}
