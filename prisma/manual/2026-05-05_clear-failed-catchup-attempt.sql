-- Story 31.1 follow-up (2026-05-05) — production incident recovery.
--
-- After the Story 31.1 commit landed, Vercel auto-deployed and ran
-- `prisma migrate deploy` BEFORE the rename SQL had been applied on
-- Supabase. Prisma saw the renamed folder
-- `20260424044105_catchup_db_push_to_migrate` as a new migration and
-- attempted to apply it against a database where the tables already
-- exist. The migration failed and Prisma recorded a row with
-- `finished_at IS NULL` for it.
--
-- After the rename SQL was then applied, the ORIGINAL successful row
-- for the catchup migration was also renamed to the same
-- `migration_name`, so `_prisma_migrations` now has TWO rows for
-- `20260424044105_catchup_db_push_to_migrate`:
--   1. The original success (`finished_at IS NOT NULL`).
--   2. Today's failed attempt (`finished_at IS NULL`).
--
-- Prisma's `migrate deploy` refuses to proceed while any row has
-- `finished_at IS NULL` (P3009). The schema itself is correct — the
-- failed attempt did not actually change anything because the catchup
-- SQL errored on the first `CREATE TABLE`.
--
-- Run this ONCE on Supabase prod, then re-trigger the Vercel deploy.
-- Idempotent: deleting zero rows on a second run is safe.

DELETE FROM _prisma_migrations
WHERE migration_name = '20260424044105_catchup_db_push_to_migrate'
  AND finished_at IS NULL;

-- Verification query — paste separately to confirm exactly one row remains:
-- SELECT id, migration_name, started_at, finished_at
-- FROM _prisma_migrations
-- WHERE migration_name = '20260424044105_catchup_db_push_to_migrate';
