-- Story 16.1: Inventory hardening — unique names and soft delete.
--
-- This migration is a canonical record of the schema change and the partial
-- unique index. The project currently syncs schema via `prisma db push`
-- (see package.json `build` script); the partial unique index is applied
-- out-of-band by `prisma/post-push.mjs` after each push. This file is not
-- auto-applied by the current deploy pipeline, but it serves as the
-- authoritative SQL source-of-truth for auditors and for a potential future
-- switch to `prisma migrate deploy`.

-- 1. Add soft-delete columns.
ALTER TABLE "inventory_item"
  ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- 2. Partial unique index enforcing case-insensitive uniqueness on ACTIVE
--    (is_deleted = false) inventory item names. Prisma cannot express partial
--    or functional unique indexes in schema.prisma — hence this raw SQL.
DROP INDEX IF EXISTS "inventory_item_name_lower_unique";

CREATE UNIQUE INDEX "inventory_item_name_lower_unique"
  ON "inventory_item" (lower("name"))
  WHERE "is_deleted" = false;
