'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { filterInventoryOptions, type InventoryOption, type InventoryType } from '@/lib/bom'

const TYPE_EMOJI: Record<InventoryType, string> = {
  MATERIAL: '🧱',
  CONSUMABLE: '🧴',
  TOOL: '🔧',
}

/**
 * Combobox thumbnail with graceful-fallback semantics:
 * - No `heroThumbnailUrl` → render the type emoji.
 * - URL present but image fails to load (404, CORS, etc.) → swap to the
 *   emoji fallback via `onError`.
 * - `loading="lazy"` + explicit width/height to keep layout stable while
 *   the long combobox list scrolls — no row jitter.
 */
function ComboboxThumbnail({ option }: { option: InventoryOption }) {
  const [broken, setBroken] = useState(false)
  if (!option.heroThumbnailUrl || broken) {
    return (
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-base"
      >
        {TYPE_EMOJI[option.type]}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={option.heroThumbnailUrl}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-8 w-8 shrink-0 rounded object-cover"
    />
  )
}

interface InventoryComboboxProps {
  options: InventoryOption[]
  onPickExisting: (option: InventoryOption) => void
  onRequestNew: (query: string) => void
  onCancel: () => void
  autoFocus?: boolean
  placeholder?: string
}

function formatQty(qty: number | null, unit: string | null): string {
  if (qty === null) return '—'
  return unit ? `${qty} ${unit}` : String(qty)
}

export function InventoryCombobox({
  options,
  onPickExisting,
  onRequestNew,
  onCancel,
  autoFocus = true,
  placeholder = 'Type to search inventory…',
}: InventoryComboboxProps) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [open, setOpen] = useState(true)
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { results, showAddNew } = useMemo(
    () => filterInventoryOptions(options, query),
    [options, query],
  )

  // Total selectable options = existing results + optional "Add new" tail
  const totalOptions = results.length + (showAddNew ? 1 : 0)

  // Derived clamped index — avoids the setState-in-effect anti-pattern.
  const effectiveHighlight = totalOptions === 0 ? 0 : Math.min(highlight, totalOptions - 1)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        onCancel()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [onCancel])

  function commitHighlighted() {
    if (totalOptions === 0) return
    if (effectiveHighlight < results.length) {
      onPickExisting(results[effectiveHighlight])
    } else {
      onRequestNew(query.trim())
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((prev) => (totalOptions === 0 ? 0 : (prev + 1) % totalOptions))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((prev) => (totalOptions === 0 ? 0 : (prev - 1 + totalOptions) % totalOptions))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commitHighlighted()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      onCancel()
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && totalOptions > 0 ? `${listboxId}-opt-${effectiveHighlight}` : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          {results.length === 0 && !showAddNew && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
          )}
          {results.map((option, i) => (
            <li
              key={option.id}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={effectiveHighlight === i}
              data-highlighted={effectiveHighlight === i}
              className={`flex min-h-[44px] cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                effectiveHighlight === i ? 'bg-accent text-accent-foreground' : ''
              }`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                // mouseDown (not click) so the outside-click handler doesn't fire first
                e.preventDefault()
                onPickExisting(option)
              }}
            >
              <ComboboxThumbnail option={option} />
              {/* `loading="lazy"` + explicit dims + onError fallback live
                  inside `<ComboboxThumbnail>` — extracted so the broken-
                  image case can swap to the type-emoji fallback without
                  duplicating the markup. */}
              <span className="flex-1 truncate">{option.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatQty(option.quantity, option.unit)}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {option.type}
              </span>
            </li>
          ))}
          {showAddNew && (
            <li
              id={`${listboxId}-opt-${results.length}`}
              role="option"
              aria-selected={effectiveHighlight === results.length}
              className={`flex min-h-[44px] cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-sm font-medium ${
                effectiveHighlight === results.length ? 'bg-accent text-accent-foreground' : ''
              }`}
              onMouseEnter={() => setHighlight(results.length)}
              onMouseDown={(e) => {
                e.preventDefault()
                onRequestNew(query.trim())
              }}
            >
              <span aria-hidden>✚</span>
              <span>Add new &quot;{query.trim()}&quot; to inventory</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
