'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
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
  // Story 25.3: track the trigger element so the dialog can return focus
  // to it on close. The trigger is the row's overflow `<Button>` —
  // captured when BomRow's "Create blocker…" menu item is clicked.
  const blockerDialogTriggerRef = useRef<HTMLElement | null>(null)
  function handleRequestCreateBlocker(row: BomItemData, trigger: HTMLElement | null) {
    blockerDialogTriggerRef.current = trigger
    setBlockerDialogRow(row)
  }

  const pillMemo = useMemo(() => <BomStatusPill rows={rows} />, [rows])

  // Filter out inventory items already linked to a row in this project's BOM.
  // Post-epic UX directive: cleaner to simply hide taken items than to surface
  // the "Already in this BOM" error toast.
  const linkedInventoryIds = useMemo(
    () => new Set(rows.map((row) => row.inventoryItem?.id).filter((id): id is string => !!id)),
    [rows],
  )
  const availableOptions = useMemo(
    () => options.filter((option) => !linkedInventoryIds.has(option.id)),
    [options, linkedInventoryIds],
  )

  const [isAddingLinked, startAddLinkedTransition] = useTransition()
  function handlePickExisting(opt: InventoryOption) {
    // Close the combobox immediately so a second click can't fire a duplicate
    // addBomItem before the first one returns. On server failure we re-open
    // it so the user has an obvious retry affordance.
    setAddState({ phase: 'closed' })
    startAddLinkedTransition(async () => {
      const result = await addBomItem({
        projectId,
        inventoryItemId: opt.id,
        requiredQuantity: 0,
        unit: opt.unit ?? undefined,
      })
      if (!result.success) {
        showErrorToast(result.error)
        setAddState({ phase: 'combobox' })
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
              heroThumbnailUrl: null,
            },
          },
        ]
      })
      showSuccessToast('BOM item added')
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
      inventoryQuantity?: number | null
    },
  ) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const inventoryItem =
          patch.inventoryQuantity !== undefined && row.inventoryItem
            ? { ...row.inventoryItem, quantity: patch.inventoryQuantity }
            : row.inventoryItem
        return {
          ...row,
          requiredQuantity: patch.requiredQuantity ?? row.requiredQuantity,
          unit: patch.unit === undefined ? row.unit : patch.unit,
          label: patch.label ?? row.label,
          consumptionState: patch.consumptionState ?? row.consumptionState,
          inventoryItem,
        }
      }),
    )
  }

  function handleRowDelete(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id))
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
          {/*
            On mobile (<sm), stack title above the status pill so the title
            fits on one line. From sm: up, lay them inline as before.
          */}
          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3 min-w-0">
            <h3 id="bom-section-title" className="text-base font-semibold">
              Bill of Materials
            </h3>
            {pillMemo}
          </div>
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
          Add item
        </Button>
      </summary>

      <div className="space-y-3 px-4 pb-4">
        <ShortageBanner rows={rows} />

        {rows.length === 0 && addState.phase === 'closed' && (
          <p className="text-sm text-muted-foreground">
            Plan your materials before you start. List what this project needs — we&apos;ll compare
            against your inventory.
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
                  <th className="w-52 py-2 pr-3 text-right">Actions</th>
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
                    onRequestCreateBlocker={handleRequestCreateBlocker}
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
                onRequestCreateBlocker={handleRequestCreateBlocker}
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
                prev.some((option) => option.id === result.created.id)
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
                      heroThumbnailUrl: null,
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
        triggerRef={blockerDialogTriggerRef}
      />
    </details>
  )
}
