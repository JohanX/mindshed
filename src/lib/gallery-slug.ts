/**
 * Gallery slug generation utilities.
 *
 * Converts project names into URL-safe slugs for public gallery URLs.
 */

export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project'
  )
}

export function ensureUniqueSlug(slug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(slug)) return slug

  let counter = 2
  while (existingSlugs.includes(`${slug}-${counter}`)) {
    counter++
  }
  return `${slug}-${counter}`
}
