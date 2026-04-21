'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, ChevronDown, Loader2 } from 'lucide-react'
import { addBomItem } from '@/actions/bom'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import { summarizeBomRows, type BomItemData } from '@/lib/bom'
import { BomRow } from '@/components/bom/bom-row'

interface BomSectionProps {
  projectId: string
  initialRows: BomItemData[]
}

function BomStatusPill({ rows }: { rows: BomItemData[] }) {
  const { total, shortCount, summary } = summarizeBomRows(rows)
  if (summary === 'empty') {
    return <span className="text-sm text-muted-foreground">0 items</span>
  }
  if (summary === 'short') {
    return (
      <span className="inline-flex items-center rounded-full bg-step-blocked px-3 py-0.5 text-xs font-medium text-white">
        {total} items · {shortCount} short
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-step-completed px-3 py-0.5 text-xs font-medium text-white">
      {total} {total === 1 ? 'item' : 'items'} · ready
    </span>
  )
}

export function BomSection({ projectId, initialRows }: BomSectionProps) {
  const [rows, setRows] = useState<BomItemData[]>(initialRows)
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [label, setLabel] = useState('')
  const [required, setRequired] = useState('')
  const [unit, setUnit] = useState('')
  const [isPending, startTransition] = useTransition()

  const pillMemo = useMemo(() => <BomStatusPill rows={rows} />, [rows])

  function resetForm() {
    setLabel('')
    setRequired('')
    setUnit('')
    setAddOpen(false)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const reqNum = Number(required)
    if (!label.trim() || !Number.isFinite(reqNum) || reqNum <= 0) return

    startTransition(async () => {
      const result = await addBomItem({
        projectId,
        label: label.trim(),
        requiredQuantity: reqNum,
        unit: unit.trim() || undefined,
      })
      if (!result.success) {
        showErrorToast(result.error)
        return
      }
      const nextSort = (rows[rows.length - 1]?.sortOrder ?? -1) + 1
      setRows((prev) => [
        ...prev,
        {
          id: result.data.id,
          label: label.trim(),
          requiredQuantity: reqNum,
          unit: unit.trim() || null,
          sortOrder: nextSort,
          consumptionState: 'NOT_CONSUMED',
          inventoryItem: null,
        },
      ])
      showSuccessToast('BOM item added')
      resetForm()
    })
  }

  function handleRowUpdate(
    id: string,
    patch: { requiredQuantity?: number; unit?: string | null; label?: string },
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              requiredQuantity: patch.requiredQuantity ?? r.requiredQuantity,
              unit: patch.unit === undefined ? r.unit : patch.unit,
              label: patch.label ?? r.label,
            }
          : r,
      ),
    )
  }

  function handleRowDelete(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <details
      className="group rounded-lg border border-border bg-card"
      open={expanded}
      onToggle={(e) => setExpanded((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden"
        aria-labelledby="bom-section-title"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown
            aria-hidden
            className="h-4 w-4 shrink-0 transition-transform group-open:rotate-0 -rotate-90"
          />
          <h3 id="bom-section-title" className="text-base font-semibold">
            Bill of Materials
          </h3>
          {pillMemo}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] shrink-0"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setExpanded(true)
            setAddOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add row
        </Button>
      </summary>

      <div className="space-y-3 px-4 pb-4">
        {rows.length === 0 && !addOpen && (
          <p className="text-sm text-muted-foreground">
            Plan your materials before you start. List what this project needs — we&apos;ll
            compare against your inventory.
          </p>
        )}

        {rows.length > 0 && (
          <div className="hidden md:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="py-2 pr-3">Item</th>
                  <th className="w-28 py-2 pr-3">Required</th>
                  <th className="w-20 py-2 pr-3">Unit</th>
                  <th className="w-48 py-2 pr-3">Available</th>
                  <th className="w-20 py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <BomRow
                    key={`${row.id}:${row.requiredQuantity}:${row.unit ?? ''}`}
                    row={row}
                    variant="desktop"
                    onUpdate={handleRowUpdate}
                    onDelete={handleRowDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-2 md:hidden">
            {rows.map((row) => (
              <BomRow
                key={`${row.id}:${row.requiredQuantity}:${row.unit ?? ''}`}
                row={row}
                variant="mobile"
                onUpdate={handleRowUpdate}
                onDelete={handleRowDelete}
              />
            ))}
          </div>
        )}

        {addOpen && (
          <form
            onSubmit={handleAdd}
            className="space-y-3 rounded-md border border-border bg-background p-3"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_7rem_5rem_auto] md:items-end">
              <div className="space-y-1">
                <Label htmlFor="bom-new-label">Item name</Label>
                <Input
                  id="bom-new-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={100}
                  placeholder="e.g., Kaolin"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bom-new-required">Required</Label>
                <Input
                  id="bom-new-required"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={required}
                  onChange={(e) => setRequired(e.target.value)}
                  placeholder="500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bom-new-unit">Unit</Label>
                <Input
                  id="bom-new-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  maxLength={50}
                  placeholder="g"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                className="min-h-[44px]"
                disabled={isPending || !label.trim() || !Number(required) || Number(required) <= 0}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={resetForm}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </details>
  )
}
