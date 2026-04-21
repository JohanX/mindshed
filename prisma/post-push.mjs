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
  console.log('[post-push] DIRECT_URL / DATABASE_URL not set — skipping (ok for builds without DB access)')
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
} finally {
  await client.end()
}
