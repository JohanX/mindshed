'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Plus, ChevronDown } from 'lucide-react'
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
import { ShortageBanner } from '@/components/bom/shortage-banner'
import { CreateBlockerDialog, type PickerStep } from '@/components/bom/create-blocker-dialog'

interface BomSectionProps {
  projectId: string
  initialRows: BomItemData[]
  initialInventoryOptions: InventoryOption[]
  projectSteps: PickerStep[]
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
  | { phase: 'new-inventory'; query: string }

export function BomSection({
  projectId,
  initialRows,
  initialInventoryOptions,
  projectSteps,
}: BomSectionProps) {
  const [rows, setRows] = useState<BomItemData[]>(initialRows)
  const [options, setOptions] = useState<InventoryOption[]>(initialInventoryOptions)
  const [addState, setAddState] = useState<AddState>({ phase: 'closed' })
  const [expanded, setExpanded] = useState(true)
  const [blockerDialogRow, setBlockerDialogRow] = useState<BomItemData | null>(null)

  const pillMemo = useMemo(() => <BomStatusPill rows={rows} />, [rows])

  // Filter out inventory items already linked to a row in this project's BOM.
  // Post-epic UX directive: cleaner to simply hide taken items than to surface
  // the "Already in this BOM" error toast.
  const linkedInventoryIds = useMemo(
    () => new Set(rows.map((r) => r.inventoryItem?.id).filter((id): id is string => !!id)),
    [rows],
  )
  const availableOptions = useMemo(
    () => options.filter((o) => !linkedInventoryIds.has(o.id)),
    [options, linkedInventoryIds],
  )

  const [isAddingLinked, startAddLinkedTransition] = useTransition()
  function handlePickExisting(opt: InventoryOption) {
    startAddLinkedTransition(async () => {
      const result = await addBomItem({
        projectId,
        inventoryItemId: opt.id,
        requiredQuantity: 0,
        unit: opt.unit ?? undefined,
      })
      if (!result.success) {
        showErrorToast(result.error)
        return
      }
      setRows((prev) => {
        const nextSort = (prev[prev.length - 1]?.sortOrder ?? -1) + 1
        return [
          ...prev,
          {
            id: result.data.id,
            label: null,
            requiredQuantity: 0,
            unit: opt.unit,
            sortOrder: nextSort,
            consumptionState: 'NOT_CONSUMED' as BomConsumptionState,
            inventoryItem: {
              id: opt.id,
              name: opt.name,
              type: opt.type,
              quantity: opt.quantity,
              isDeleted: false,
            },
          },
        ]
      })
      showSuccessToast('BOM item added')
      setAddState({ phase: 'closed' })
    })
  }

  function handleRowUpdate(
    id: string,
    patch: {
      requiredQuantity?: number
      unit?: string | null
      label?: string
      consumptionState?: BomConsumptionState
      consumedAt?: Date | null
      unconsumedAt?: Date | null
    },
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              requiredQuantity: patch.requiredQuantity ?? r.requiredQuantity,
              unit: patch.unit === undefined ? r.unit : patch.unit,
              label: patch.label ?? r.label,
              consumptionState: patch.consumptionState ?? r.consumptionState,
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
        <ShortageBanner rows={rows} />

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
                    key={`${row.id}:${row.requiredQuantity}:${row.unit ?? ''}:${row.consumptionState}`}
                    row={row}
                    variant="desktop"
                    onUpdate={handleRowUpdate}
                    onDelete={handleRowDelete}
                    onRequestCreateBlocker={setBlockerDialogRow}
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
                key={`${row.id}:${row.requiredQuantity}:${row.unit ?? ''}:${row.consumptionState}`}
                row={row}
                variant="mobile"
                onUpdate={handleRowUpdate}
                onDelete={handleRowDelete}
                onRequestCreateBlocker={setBlockerDialogRow}
              />
            ))}
          </div>
        )}

        {addState.phase === 'combobox' && (
          <div className="space-y-2 rounded-md border border-border bg-background p-3">
            <Label>Add item</Label>
            <InventoryCombobox
              options={availableOptions}
              onPickExisting={handlePickExisting}
              onRequestNew={(query) => setAddState({ phase: 'new-inventory', query })}
              onCancel={() => {
                if (!isAddingLinked) setAddState({ phase: 'closed' })
              }}
            />
          </div>
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

      <CreateBlockerDialog
        open={blockerDialogRow !== null}
        row={blockerDialogRow}
        steps={projectSteps}
        onClose={() => setBlockerDialogRow(null)}
      />
    </details>
  )
}

