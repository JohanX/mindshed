function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function nextCloneName(baseName: string, existingNames: string[]): string {
  const esc = escapeRegex(baseName)
  const firstSlot = new RegExp(`^${esc} \\(copy\\)$`)
  const nthSlot = new RegExp(`^${esc} \\(copy (\\d+)\\)$`)

  const takenIntegers = new Set<number>()
  for (const name of existingNames) {
    if (firstSlot.test(name)) {
      takenIntegers.add(1)
      continue
    }
    const match = nthSlot.exec(name)
    if (match) {
      const n = Number(match[1])
      if (Number.isInteger(n) && n >= 2) takenIntegers.add(n)
    }
  }

  let n = 1
  while (takenIntegers.has(n)) n += 1
  return n === 1 ? `${baseName} (copy)` : `${baseName} (copy ${n})`
}
