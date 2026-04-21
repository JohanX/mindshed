-- Story 16.2: BOM data model and basic CRUD.
--
-- Canonical record of the schema change. The project syncs schema via
-- `prisma db push` (see package.json `build` script); the partial unique
-- index is applied out-of-band by `prisma/post-push.mjs` after each push.
-- This file is not auto-applied today but serves as the authoritative SQL
-- source-of-truth for auditors and for a potential future switch to
-- `prisma migrate deploy`.

-- 1. Enum for consumption state.
CREATE TYPE "BomConsumptionState" AS ENUM ('NOT_CONSUMED', 'CONSUMED', 'UNDONE');

-- 2. BOM item table.
CREATE TABLE "bom_item" (
  "id"                 TEXT PRIMARY KEY,
  "project_id"         TEXT NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "inventory_item_id"  TEXT REFERENCES "inventory_item"("id") ON DELETE SET NULL,
  "label"              TEXT,
  "required_quantity"  DOUBLE PRECISION NOT NULL,
  "unit"               TEXT,
  "consumption_state"  "BomConsumptionState" NOT NULL DEFAULT 'NOT_CONSUMED',
  "consumed_at"        TIMESTAMP(3),
  "unconsumed_at"      TIMESTAMP(3),
  "sort_order"         INTEGER NOT NULL DEFAULT 0,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL
);

-- 3. Partial unique index — prevents duplicate inventory-linked BOM rows per
--    project while still permitting multiple free-form (unlinked) rows.
DROP INDEX IF EXISTS "bom_item_project_inventory_unique";

CREATE UNIQUE INDEX "bom_item_project_inventory_unique"
  ON "bom_item" ("project_id", "inventory_item_id")
  WHERE "inventory_item_id" IS NOT NULL;

-- 4. Lookup index for typical list query (ordered by sortOrder per project).
CREATE INDEX "bom_item_project_id_sort_order_idx"
  ON "bom_item" ("project_id", "sort_order");
