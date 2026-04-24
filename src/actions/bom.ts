'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import {
  addBomItemSchema,
  updateBomItemSchema,
  addBomItemWithNewInventorySchema,
  createBomShortageBlockerSchema,
  markBomItemConsumedSchema,
  undoBomItemConsumptionSchema,
  type AddBomItemInput,
  type UpdateBomItemInput,
  type AddBomItemWithNewInventoryInput,
  type CreateBomShortageBlockerInput,
  type MarkBomItemConsumedInput,
  type UndoBomItemConsumptionInput,
} from '@/lib/schemas/bom'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import { buildShortageBlockerDescription, isRowShort, type BomItemData } from '@/lib/bom'
import { nextUniqueInventoryName } from '@/lib/inventory-name'

function isP2002(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}

function isP2025(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  )
}

export async function addBomItem(input: AddBomItemInput): Promise<ActionResult<{ id: string }>> {
  const parsed = addBomItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { projectId, inventoryItemId, label, requiredQuantity, unit } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { hobbyId: true },
      })
      if (!project) throw Object.assign(new Error('PROJECT_NOT_FOUND'), { code: 'P2025' })

      if (inventoryItemId) {
        const inv = await tx.inventoryItem.findUnique({
          where: { id: inventoryItemId },
          select: { isDeleted: true },
        })
        if (!inv || inv.isDeleted) throw new Error('INVENTORY_NOT_AVAILABLE')
      }

      const maxSort = await tx.bomItem.aggregate({
        where: { projectId },
        _max: { sortOrder: true },
      })
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1

      const item = await tx.bomItem.create({
        data: {
          projectId,
          inventoryItemId: inventoryItemId ?? null,
          label: label ?? null,
          requiredQuantity,
          unit: unit ?? null,
          sortOrder,
        },
        select: { id: true },
      })

      await tx.project.update({
        where: { id: projectId },
        data: { lastActivityAt: new Date() },
      })

      return { id: item.id, hobbyId: project.hobbyId }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${projectId}`)
    return { success: true, data: { id: result.id } }
  } catch (error) {
    if (isP2002(error)) {
      return { success: false, error: 'This inventory item is already in this project.' }
    }
    if (isP2025(error)) {
      return { success: false, error: 'Project not found.' }
    }
    if (error instanceof Error && error.message === 'INVENTORY_NOT_AVAILABLE') {
      return { success: false, error: 'Inventory item not available.' }
    }
    console.error('addBomItem failed:', error)
    return { success: false, error: 'Failed to add BOM item.' }
  }
}

export async function updateBomItem(
  input: UpdateBomItemInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateBomItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { id, ...rest } = parsed.data
  const data: Record<string, unknown> = {}
  if (rest.requiredQuantity !== undefined) data.requiredQuantity = rest.requiredQuantity
  if (rest.unit !== undefined) data.unit = rest.unit
  if (rest.label !== undefined) data.label = rest.label

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.bomItem.findUnique({
        where: { id },
        select: { projectId: true, inventoryItemId: true, project: { select: { hobbyId: true } } },
      })
      if (!existing) throw Object.assign(new Error('BOM_ITEM_NOT_FOUND'), { code: 'P2025' })

      // Silently drop `label` updates on inventory-linked rows — display uses
      // inventoryItem.name for those; persisting a dead label would muddy state.
      if (existing.inventoryItemId !== null && 'label' in data) {
        delete data.label
      }

      await tx.bomItem.update({ where: { id }, data })
      await tx.project.update({
        where: { id: existing.projectId },
        data: { lastActivityAt: new Date() },
      })
      return { id, hobbyId: existing.project.hobbyId, projectId: existing.projectId }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${result.projectId}`)
    return { success: true, data: { id: result.id } }
  } catch (error) {
    if (isP2025(error)) {
      return { success: false, error: 'BOM item not found.' }
    }
    console.error('updateBomItem failed:', error)
    return { success: false, error: 'Failed to update BOM item.' }
  }
}

export async function deleteBomItem(bomItemId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(bomItemId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid BOM item ID.' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.bomItem.findUnique({
        where: { id: parsed.data },
        select: { projectId: true, project: { select: { hobbyId: true } } },
      })
      if (!existing) throw Object.assign(new Error('BOM_ITEM_NOT_FOUND'), { code: 'P2025' })

      // Intentionally delete only the BomItem row — the linked InventoryItem is untouched.
      await tx.bomItem.delete({ where: { id: parsed.data } })
      await tx.project.update({
        where: { id: existing.projectId },
        data: { lastActivityAt: new Date() },
      })
      return { hobbyId: existing.project.hobbyId, projectId: existing.projectId }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${result.projectId}`)
    return { success: true, data: null }
  } catch (error) {
    if (isP2025(error)) {
      return { success: false, error: 'BOM item not found.' }
    }
    console.error('deleteBomItem failed:', error)
    return { success: false, error: 'Failed to delete BOM item.' }
  }
}

export async function addBomItemWithNewInventory(
  input: AddBomItemWithNewInventoryInput,
): Promise<ActionResult<{ id: string; inventoryItemId: string; finalName: string }>> {
  const parsed = addBomItemWithNewInventorySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { projectId, newItem, requiredQuantity, unit } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { hobbyId: true },
      })
      if (!project) throw Object.assign(new Error('PROJECT_NOT_FOUND'), { code: 'P2025' })

      const existing = await tx.inventoryItem.findMany({
        where: { isDeleted: false },
        select: { name: true },
      })
      const finalName = nextUniqueInventoryName(
        newItem.name,
        existing.map((existingItem) => existingItem.name),
      )

      const createdInventoryItem = await tx.inventoryItem.create({
        data: {
          name: finalName,
          type: newItem.type,
          quantity: newItem.startingQuantity ?? 0,
          unit: newItem.unit ?? null,
        },
        select: { id: true, unit: true },
      })

      const maxSort = await tx.bomItem.aggregate({
        where: { projectId },
        _max: { sortOrder: true },
      })
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1

      const bomItem = await tx.bomItem.create({
        data: {
          projectId,
          inventoryItemId: createdInventoryItem.id,
          label: null,
          requiredQuantity,
          unit: unit ?? createdInventoryItem.unit ?? null,
          sortOrder,
        },
        select: { id: true },
      })

      await tx.project.update({
        where: { id: projectId },
        data: { lastActivityAt: new Date() },
      })

      return {
        id: bomItem.id,
        inventoryItemId: createdInventoryItem.id,
        finalName,
        hobbyId: project.hobbyId,
      }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${projectId}`)
    revalidatePath('/inventory')
    return {
      success: true,
      data: {
        id: result.id,
        inventoryItemId: result.inventoryItemId,
        finalName: result.finalName,
      },
    }
  } catch (error) {
    if (isP2002(error)) {
      return { success: false, error: 'Item name collided — please retry.' }
    }
    if (isP2025(error)) {
      return { success: false, error: 'Project not found.' }
    }
    console.error('addBomItemWithNewInventory failed:', error)
    return { success: false, error: 'Failed to add inventory item and BOM row.' }
  }
}

export async function getBomItemsByProject(
  projectId: string,
): Promise<ActionResult<BomItemData[]>> {
  const parsed = z.uuid().safeParse(projectId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid project ID.' }
  }

  try {
    const rows = await prisma.bomItem.findMany({
      where: { projectId: parsed.data },
      orderBy: { sortOrder: 'asc' },
      include: {
        inventoryItem: {
          select: { id: true, name: true, type: true, quantity: true, isDeleted: true },
        },
      },
    })

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        label: row.label,
        requiredQuantity: row.requiredQuantity,
        unit: row.unit,
        sortOrder: row.sortOrder,
        consumptionState: row.consumptionState,
        inventoryItem: row.inventoryItem,
      })),
    }
  } catch (error) {
    console.error('getBomItemsByProject failed:', error)
    return { success: false, error: 'Failed to load BOM items.' }
  }
}

export async function createBomShortageBlocker(
  input: CreateBomShortageBlockerInput,
  // Internal — bounded retry after P2002 from the partial unique index.
  // Not part of the public signature; callers must not pass this.
  _retryOnRace: boolean = true,
): Promise<
  ActionResult<{
    blockerId: string
    stepName: string
    alreadyExisted: boolean
  }>
> {
  const parsed = createBomShortageBlockerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { bomItemId, stepId } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.bomItem.findUnique({
        where: { id: bomItemId },
        select: {
          id: true,
          requiredQuantity: true,
          unit: true,
          projectId: true,
          consumptionState: true,
          label: true,
          sortOrder: true,
          inventoryItem: {
            select: { id: true, name: true, type: true, quantity: true, isDeleted: true },
          },
          project: { select: { hobbyId: true } },
        },
      })
      if (!row) throw Object.assign(new Error('BOM_NOT_FOUND'), { code: 'P2025' })
      const inv = row.inventoryItem
      if (!inv || inv.isDeleted) throw new Error('BOM_ITEM_UNAVAILABLE')
      // Use the shared shortage predicate so server-side re-validation stays in
      // lockstep with the UI's isRowShort() — any future tweak (unit
      // normalization, threshold) applies to both paths without drift.
      const shortRow: BomItemData = {
        id: row.id,
        label: row.label,
        requiredQuantity: row.requiredQuantity,
        unit: row.unit,
        sortOrder: row.sortOrder,
        consumptionState: row.consumptionState,
        inventoryItem: inv,
      }
      if (!isRowShort(shortRow)) throw new Error('NOT_SHORT')

      const step = await tx.step.findUnique({
        where: { id: stepId },
        select: { id: true, name: true, state: true, projectId: true },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')
      if (step.projectId !== row.projectId) throw new Error('STEP_WRONG_PROJECT')
      if (step.state === 'COMPLETED') throw new Error('STEP_COMPLETED')

      // Dedup: an unresolved blocker for this (step, inventory item) already
      // exists — return it unchanged.
      const existing = await tx.blocker.findFirst({
        where: { stepId: step.id, inventoryItemId: inv.id, isResolved: false },
        select: { id: true },
      })
      if (existing) {
        return {
          blockerId: existing.id,
          stepName: step.name,
          alreadyExisted: true,
          hobbyId: row.project.hobbyId,
          projectId: row.projectId,
        }
      }

      const description = buildShortageBlockerDescription(shortRow)

      // If a concurrent call raced past our findFirst check and committed
      // first, the partial unique index blocker_step_inv_unresolved_unique
      // will raise P2002 here. We let it bubble to the outer catch, which
      // retries the whole action once — on retry the findFirst above sees
      // the now-committed raced blocker and returns alreadyExisted=true.
      const blocker = await tx.blocker.create({
        data: { stepId: step.id, inventoryItemId: inv.id, description },
      })

      // Cascade step state to BLOCKED (mirror createBlocker behavior).
      if (step.state !== 'BLOCKED') {
        await tx.step.update({
          where: { id: step.id },
          data: { previousState: step.state, state: 'BLOCKED' },
        })
      }

      await tx.project.update({
        where: { id: row.projectId },
        data: { lastActivityAt: new Date() },
      })

      return {
        blockerId: blocker.id,
        stepName: step.name,
        alreadyExisted: false,
        hobbyId: row.project.hobbyId,
        projectId: row.projectId,
      }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${result.projectId}`)
    revalidatePath(`/hobbies/${result.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')

    return {
      success: true,
      data: {
        blockerId: result.blockerId,
        stepName: result.stepName,
        alreadyExisted: result.alreadyExisted,
      },
    }
  } catch (error) {
    // P2002 from the partial unique index on Blocker means a concurrent call
    // committed first. The failed statement leaves the PG tx aborted, so we
    // can't safely re-query inside the same tx — retry the whole action once
    // with a fresh tx. On retry, the dedup findFirst sees the committed raced
    // row and returns alreadyExisted=true (same UX as the non-racing dedup).
    if (isP2002(error) && _retryOnRace) {
      return createBomShortageBlocker(input, false)
    }
    if (isP2025(error)) {
      return { success: false, error: 'BOM item not found.' }
    }
    if (error instanceof Error) {
      if (error.message === 'BOM_NOT_FOUND') {
        return { success: false, error: 'BOM item not found.' }
      }
      if (error.message === 'BOM_ITEM_UNAVAILABLE') {
        return { success: false, error: 'Cannot create blocker for this row.' }
      }
      if (error.message === 'NOT_SHORT') {
        return { success: false, error: 'This row is no longer short — reload.' }
      }
      if (error.message === 'STEP_NOT_FOUND') {
        return { success: false, error: 'Step not found.' }
      }
      if (error.message === 'STEP_WRONG_PROJECT') {
        return { success: false, error: 'Step does not belong to this project.' }
      }
      if (error.message === 'STEP_COMPLETED') {
        return { success: false, error: 'Cannot block a completed step.' }
      }
    }
    console.error('createBomShortageBlocker failed:', error)
    return { success: false, error: 'Failed to create blocker.' }
  }
}

export async function markBomItemConsumed(
  input: MarkBomItemConsumedInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = markBomItemConsumedSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid BOM item ID.' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.bomItem.findUnique({
        where: { id: parsed.data.id },
        select: {
          requiredQuantity: true,
          consumptionState: true,
          projectId: true,
          inventoryItem: {
            select: {
              id: true,
              name: true,
              quantity: true,
              isDeleted: true,
              type: true,
            },
          },
          project: { select: { hobbyId: true } },
        },
      })
      if (!row) throw Object.assign(new Error('BOM_ITEM_NOT_FOUND'), { code: 'P2025' })
      if (row.consumptionState !== 'NOT_CONSUMED') throw new Error('ALREADY_CONSUMED')
      const inv = row.inventoryItem
      if (!inv || inv.isDeleted || inv.type !== 'MATERIAL') {
        throw new Error('NOT_MATERIAL_LINKED')
      }
      if (inv.quantity === null || inv.quantity < row.requiredQuantity) {
        const err = new Error('INSUFFICIENT_INVENTORY')
        ;(err as Error & { itemName?: string }).itemName = inv.name
        throw err
      }

      await tx.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: { decrement: row.requiredQuantity } },
      })

      await tx.bomItem.update({
        where: { id: parsed.data.id },
        data: { consumptionState: 'CONSUMED', consumedAt: new Date() },
      })

      await tx.project.update({
        where: { id: row.projectId },
        data: { lastActivityAt: new Date() },
      })

      return {
        id: parsed.data.id,
        projectId: row.projectId,
        hobbyId: row.project.hobbyId,
        inventoryName: inv.name,
      }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${result.projectId}`)
    revalidatePath('/inventory')
    return { success: true, data: { id: result.id } }
  } catch (error) {
    if (isP2025(error)) {
      return { success: false, error: 'BOM item not found.' }
    }
    if (error instanceof Error) {
      if (error.message === 'INSUFFICIENT_INVENTORY') {
        const name = (error as Error & { itemName?: string }).itemName ?? 'item'
        return {
          success: false,
          error: `Not enough ${name} in inventory. Create shortage blockers first.`,
        }
      }
      if (error.message === 'ALREADY_CONSUMED') {
        return { success: false, error: 'Row already consumed.' }
      }
      if (error.message === 'NOT_MATERIAL_LINKED') {
        return { success: false, error: 'Cannot mark this row as consumed.' }
      }
    }
    console.error('markBomItemConsumed failed:', error)
    return { success: false, error: 'Failed to mark as consumed.' }
  }
}

export async function undoBomItemConsumption(
  input: UndoBomItemConsumptionInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = undoBomItemConsumptionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid BOM item ID.' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.bomItem.findUnique({
        where: { id: parsed.data.id },
        select: {
          requiredQuantity: true,
          consumptionState: true,
          projectId: true,
          inventoryItem: { select: { id: true, name: true } },
          project: { select: { hobbyId: true } },
        },
      })
      if (!row) throw Object.assign(new Error('BOM_ITEM_NOT_FOUND'), { code: 'P2025' })
      if (row.consumptionState !== 'CONSUMED') throw new Error('NOT_CONSUMED_STATE')
      if (!row.inventoryItem) throw new Error('NO_INVENTORY_LINK')

      // Credit inventory back — even if soft-deleted (AC #7): accounting integrity
      // wins over hiding the row from lists.
      await tx.inventoryItem.update({
        where: { id: row.inventoryItem.id },
        data: { quantity: { increment: row.requiredQuantity } },
      })

      await tx.bomItem.update({
        where: { id: parsed.data.id },
        data: { consumptionState: 'NOT_CONSUMED', unconsumedAt: new Date() },
      })

      await tx.project.update({
        where: { id: row.projectId },
        data: { lastActivityAt: new Date() },
      })

      return {
        id: parsed.data.id,
        projectId: row.projectId,
        hobbyId: row.project.hobbyId,
        inventoryName: row.inventoryItem.name,
      }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${result.projectId}`)
    revalidatePath('/inventory')
    return { success: true, data: { id: result.id } }
  } catch (error) {
    if (isP2025(error)) {
      return { success: false, error: 'BOM item not found.' }
    }
    if (error instanceof Error) {
      if (error.message === 'NOT_CONSUMED_STATE') {
        return { success: false, error: 'Row is not in a consumed state.' }
      }
      if (error.message === 'NO_INVENTORY_LINK') {
        return { success: false, error: 'Cannot undo a row without an inventory link.' }
      }
    }
    console.error('undoBomItemConsumption failed:', error)
    return { success: false, error: 'Failed to undo consumption.' }
  }
}
