'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import {
  addBomItemSchema,
  updateBomItemSchema,
  type AddBomItemInput,
  type UpdateBomItemInput,
} from '@/lib/schemas/bom'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import type { BomItemData } from '@/lib/bom'

function isP2002(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002'
}

function isP2025(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025'
}

export async function addBomItem(
  input: AddBomItemInput,
): Promise<ActionResult<{ id: string }>> {
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
      data: rows.map((r) => ({
        id: r.id,
        label: r.label,
        requiredQuantity: r.requiredQuantity,
        unit: r.unit,
        sortOrder: r.sortOrder,
        consumptionState: r.consumptionState,
        inventoryItem: r.inventoryItem,
      })),
    }
  } catch (error) {
    console.error('getBomItemsByProject failed:', error)
    return { success: false, error: 'Failed to load BOM items.' }
  }
}
