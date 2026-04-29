/**
 * Cloudinary thumbnail-transform widths per surface (FR106 — 2× the CSS-px
 * display target for retina sharpness). Updated by Story 26.3 to split the
 * old `GRID = 800` between two distinct surfaces:
 *  - `PHOTO_GRID = 160` for photo-grid thumbnails (~80 CSS-px display, e.g.
 *    the inventory edit dialog's photo grid + step image gallery grid)
 *  - `GRID = 800` retained for the lightbox / large-display surface (~600+
 *    CSS-px), where the source needs to be substantially larger
 */
export const THUMBNAIL_WIDTH = {
  DASHBOARD_CARD: 128,
  STRIP: 160,
  GALLERY_SECTION: 160,
  /** Lightbox / large-display source (use for click-through full views). */
  GRID: 800,
  /** Photo-grid thumbnails — small tiled previews (~80 CSS-px). */
  PHOTO_GRID: 160,
  INVENTORY_CARD: 96,
  BOM_ROW: 56,
} as const
