'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, ChevronDown, Loader2 } from 'lucide-react'
import { addBomItem } from '@/actions/bom'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import {
  summarizeBomRows,
  type BomItemData,
  type InventoryOption,
  type BomConsumptionState,
} from '@/lib/bom'
import { BomRow } from '@/components/bom/bom-row'
import { InventoryCombobox } from '@/components/bom/inventory-combobox'
import { BomNewInventoryForm } from '@/components/bom/bom-new-inventory-form'

interface BomSectionProps {
  projectId: string
  initialRows: BomItemData[]
  initialInventoryOptions: InventoryOption[]
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

type AddState =
  | { phase: 'closed' }
  | { phase: 'combobox' }
  | { phase: 'pick-required'; picked: InventoryOption }
  | { phase: 'new-inventory'; query: string }

export function BomSection({
  projectId,
  initialRows,
  initialInventoryOptions,
}: BomSectionProps) {
  const [rows, setRows] = useState<BomItemData[]>(initialRows)
  const [options, setOptions] = useState<InventoryOption[]>(initialInventoryOptions)
  const [addState, setAddState] = useState<AddState>({ phase: 'closed' })
  const [expanded, setExpanded] = useState(true)

  const pillMemo = useMemo(() => <BomStatusPill rows={rows} />, [rows])

  // NOTE: we deliberately do NOT filter out already-linked inventory items from
  // the combobox. AC #4 wants the user to be able to attempt a duplicate add and
  // receive the "Already in this BOM" toast — that signals the mistake clearly
  // and is handled by PickRequiredForm's P2002 → toast remap.

  function appendRow(row: BomItemData) {
    setRows((prev) => [...prev, row])
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
            setAddState({ phase: 'combobox' })
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add row
        </Button>
      </summary>

      <div className="space-y-3 px-4 pb-4">
        {rows.length === 0 && addState.phase === 'closed' && (
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

        {addState.phase === 'combobox' && (
          <div className="space-y-2 rounded-md border border-border bg-background p-3">
            <Label>Add item</Label>
            <InventoryCombobox
              options={options}
              onPickExisting={(opt) => setAddState({ phase: 'pick-required', picked: opt })}
              onRequestNew={(query) => setAddState({ phase: 'new-inventory', query })}
              onCancel={() => setAddState({ phase: 'closed' })}
            />
          </div>
        )}

        {addState.phase === 'pick-required' && (
          <PickRequiredForm
            projectId={projectId}
            picked={addState.picked}
            onSaved={(row) => {
              appendRow(row)
              setAddState({ phase: 'closed' })
            }}
            onCancel={() => setAddState({ phase: 'closed' })}
          />
        )}

        {addState.phase === 'new-inventory' && (
          <BomNewInventoryForm
            projectId={projectId}
            initialName={addState.query}
            onSaved={(result) => {
              setOptions((prev) =>
                prev.some((o) => o.id === result.created.id)
                  ? prev
                  : [...prev, result.created],
              )
              setRows((prev) => {
                const nextSort = (prev[prev.length - 1]?.sortOrder ?? -1) + 1
                return [
                  ...prev,
                  {
                    id: result.id,
                    label: null,
                    requiredQuantity: result.requiredQuantity,
                    unit: result.unit,
                    sortOrder: nextSort,
                    consumptionState: 'NOT_CONSUMED' as BomConsumptionState,
                    inventoryItem: {
                      id: result.created.id,
                      name: result.created.name,
                      type: result.created.type,
                      quantity: result.created.quantity,
                      isDeleted: false,
                    },
                  },
                ]
              })
              setAddState({ phase: 'closed' })
            }}
            onCancel={() => setAddState({ phase: 'closed' })}
          />
        )}
      </div>
    </details>
  )
}

function PickRequiredForm({
  projectId,
  picked,
  onSaved,
  onCancel,
}: {
  projectId: string
  picked: InventoryOption
  onSaved: (row: BomItemData) => void
  onCancel: () => void
}) {
  const [required, setRequired] = useState('')
  const [unit, setUnit] = useState(picked.unit ?? '')
  const [isPending, startTransition] = useTransition()

  const requiredNum = Number(required)
  const canSave = Number.isFinite(requiredNum) && requiredNum > 0

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    startTransition(async () => {
      const result = await addBomItem({
        projectId,
        inventoryItemId: picked.id,
        requiredQuantity: requiredNum,
        unit: unit.trim() || undefined,
      })
      if (!result.success) {
        // AC #4: remap the server's "This inventory item is already in this project."
        // to the spec-mandated shorter string.
        const toastMessage =
          result.error === 'This inventory item is already in this project.'
            ? 'Already in this BOM'
            : result.error
        showErrorToast(toastMessage)
        return
      }
      showSuccessToast('BOM item added')
      onSaved({
        id: result.data.id,
        label: null,
        requiredQuantity: requiredNum,
        unit: unit.trim() || null,
        sortOrder: 0, // sortOrder authoritative on server; local value is a placeholder for render
        consumptionState: 'NOT_CONSUMED' as BomConsumptionState,
        inventoryItem: {
          id: picked.id,
          name: picked.name,
          type: picked.type,
          quantity: picked.quantity,
          isDeleted: false,
        },
      })
    })
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-3 rounded-md border border-border bg-background p-3"
    >
      <div className="text-sm font-medium">
        <span className="text-muted-foreground">Selected: </span>
        {picked.name}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_7rem_auto] md:items-end">
        <div className="space-y-1">
          <Label htmlFor="bom-pick-required">Required</Label>
          <Input
            id="bom-pick-required"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={required}
            onChange={(e) => setRequired(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bom-pick-unit">Unit</Label>
          <Input
            id="bom-pick-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            maxLength={50}
            placeholder={picked.unit ?? ''}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          className="min-h-[44px]"
          disabled={!canSave || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
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
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
