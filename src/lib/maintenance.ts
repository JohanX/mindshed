export function getNextMaintenanceDate(lastMaintenanceDate: Date, intervalDays: number): Date {
  const next = new Date(lastMaintenanceDate)
  next.setDate(next.getDate() + intervalDays)
  return next
}

export function isMaintenanceOverdue(lastMaintenanceDate: Date, intervalDays: number): boolean {
  return getNextMaintenanceDate(lastMaintenanceDate, intervalDays) < new Date()
}

export function getDaysOverdue(lastMaintenanceDate: Date, intervalDays: number): number {
  const next = getNextMaintenanceDate(lastMaintenanceDate, intervalDays)
  const diff = Date.now() - next.getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}
