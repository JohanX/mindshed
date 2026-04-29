-- Enable Row Level Security on every public-schema table (Supabase
-- PostgREST hardening). Without RLS, tables are exposed via the anon /
-- authenticated PostgREST roles. The Prisma DATABASE_URL connects as a
-- role that bypasses RLS (Supabase `postgres` / `service_role`), so the
-- app's own access is unaffected.
--
-- Defensive design — addresses two problems with per-table migrations:
-- 1. New tables added between RLS migrations get missed (this is what
--    happened: idea_image, inventory_item_image, _HobbyToInventoryItem,
--    and _prisma_migrations were left without RLS after the original
--    20260424_catchup_db_push_to_migrate manual setup).
-- 2. A fresh `prisma migrate deploy` from zero would otherwise need
--    every named-table migration to stay in sync with the schema.
--
-- The DO block enumerates `pg_tables` at apply time and runs
-- `ENABLE ROW LEVEL SECURITY` on each. `ENABLE ROW LEVEL SECURITY` is
-- itself idempotent (no-op on already-enabled tables), but we still
-- wrap the per-table ALTER in an EXCEPTION handler so a single
-- problematic table cannot abort the whole migration — it just logs a
-- NOTICE and the rest continue.

DO $$
DECLARE
  rls_table RECORD;
BEGIN
  FOR rls_table IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', rls_table.tablename);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped RLS on table %: %', rls_table.tablename, SQLERRM;
    END;
  END LOOP;
END $$;
