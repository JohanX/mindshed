#!/usr/bin/env node
// Applies raw-SQL schema artifacts that Prisma cannot express in schema.prisma.
// Runs after `prisma db push` in both dev/prod deploys (see package.json build
// script) and in E2E global-setup. Idempotent: drop-then-create guarantees the
// partial index predicate always matches the current definition — preventing
// silent predicate drift when the clause changes over time.

import pg from 'pg'
import 'dotenv/config'

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) {
  console.log(
    '[post-push] DIRECT_URL / DATABASE_URL not set — skipping (ok for builds without DB access)',
  )
  process.exit(0)
}

const client = new pg.Client({ connectionString })
await client.connect()

try {
  // Partial unique index enforcing case-insensitive uniqueness on active
  // inventory item names. Story 16.1 (Epic 16).
  await client.query('DROP INDEX IF EXISTS "inventory_item_name_lower_unique"')
  await client.query(`
    CREATE UNIQUE INDEX "inventory_item_name_lower_unique"
      ON "inventory_item" (lower("name"))
      WHERE "is_deleted" = false
  `)
  console.log('[post-push] inventory_item_name_lower_unique partial index applied.')

  // Partial unique index preventing duplicate inventory-linked BOM rows per
  // project. Free-form rows (inventory_item_id IS NULL) are unconstrained.
  // Story 16.2 (Epic 16).
  await client.query('DROP INDEX IF EXISTS "bom_item_project_inventory_unique"')
  await client.query(`
    CREATE UNIQUE INDEX "bom_item_project_inventory_unique"
      ON "bom_item" ("project_id", "inventory_item_id")
      WHERE "inventory_item_id" IS NOT NULL
  `)
  console.log('[post-push] bom_item_project_inventory_unique partial index applied.')

  // Partial unique index preventing duplicate unresolved blockers for the
  // same (step, inventory_item) pair. Closes the TOCTOU race between the
  // findFirst dedup check and blocker.create in createBomShortageBlocker.
  // Story 18.1 (Epic 18).
  await client.query('DROP INDEX IF EXISTS "blocker_step_inv_unresolved_unique"')
  await client.query(`
    CREATE UNIQUE INDEX "blocker_step_inv_unresolved_unique"
      ON "blocker" ("step_id", "inventory_item_id")
      WHERE "is_resolved" = false AND "inventory_item_id" IS NOT NULL
  `)
  console.log('[post-push] blocker_step_inv_unresolved_unique partial index applied.')
} finally {
  await client.end()
}
