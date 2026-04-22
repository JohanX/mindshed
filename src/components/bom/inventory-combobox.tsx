'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { filterInventoryOptions, type InventoryOption, type InventoryType } from '@/lib/bom'

const TYPE_EMOJI: Record<InventoryType, string> = {
  MATERIAL: '🧱',
  CONSUMABLE: '🧴',
  TOOL: '🔧',
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
      setHighlight((h) => (totalOptions === 0 ? 0 : (h + 1) % totalOptions))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (totalOptions === 0 ? 0 : (h - 1 + totalOptions) % totalOptions))
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
          {results.map((o, i) => (
            <li
              key={o.id}
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
                onPickExisting(o)
              }}
            >
              <span aria-hidden>{TYPE_EMOJI[o.type]}</span>
              <span className="flex-1 truncate">{o.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatQty(o.quantity, o.unit)}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {o.type}
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
