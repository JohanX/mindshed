/**
 * Idea-related pure helpers.
 */

/**
 * Format an idea's referenceLink as readable trimmed text for display next to
 * the link icon. Returns `host + pathname` (without trailing slash) truncated
 * to maxLen with a trailing ellipsis. On URL parse failure, falls back to
 * trimming the raw string.
 */
export function formatReferenceUrl(url: string, maxLen = 32): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname
    const compact = `${u.host}${path}`
    return compact.length <= maxLen ? compact : `${compact.slice(0, maxLen - 1)}…`
  } catch {
    return url.length <= maxLen ? url : `${url.slice(0, maxLen - 1)}…`
  }
}
