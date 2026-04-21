function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Resolve a globally-unique inventory item name. Case-insensitive collision
 * detection against `existingNames`; preserves the caller's original casing on
 * the returned string. The helper suffixes `" (1)"`, `" (2)"`, ... on collision
 * — gap-filling the lowest free slot. If `baseName` itself does not collide,
 * it is returned unchanged (unlike `nextCloneName`, which always suffixes).
 */
export function nextUniqueInventoryName(baseName: string, existingNames: string[]): string {
  const esc = escapeRegex(baseName)
  const baseRegex = new RegExp(`^${esc}$`, 'i')
  const suffixRegex = new RegExp(`^${esc} \\((\\d+)\\)$`, 'i')

  let baseTaken = false
  const takenIntegers = new Set<number>()

  for (const name of existingNames) {
    if (baseRegex.test(name)) {
      baseTaken = true
      continue
    }
    const match = suffixRegex.exec(name)
    if (!match) continue
    const raw = match[1]
    // Ignore malformed leading-zero / non-canonical forms like "(01)"
    if (raw !== String(Number(raw))) continue
    const n = Number(raw)
    if (Number.isInteger(n) && n >= 1) takenIntegers.add(n)
  }

  if (!baseTaken) return baseName

  let n = 1
  while (takenIntegers.has(n)) n += 1
  return `${baseName} (${n})`
}
