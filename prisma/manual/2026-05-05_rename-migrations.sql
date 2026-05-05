-- Story 31.1 (2026-05-05) — rename migration_name entries to match the
-- renamed folders. Run ONCE on each environment (Supabase prod) BEFORE
-- the next `prisma migrate deploy` so deploy doesn't see the renamed
-- folders as unapplied migrations.
--
-- The local dev database has already been updated as part of the story
-- implementation; this file is committed for production application.
--
-- All UPDATEs are idempotent — re-running is safe (rows already at the
-- target name update zero rows).

UPDATE _prisma_migrations SET migration_name = '20260424044105_catchup_db_push_to_migrate' WHERE migration_name = '20260424_catchup_db_push_to_migrate';
UPDATE _prisma_migrations SET migration_name = '20260424071810_remove_undone_bom_state'    WHERE migration_name = '20260424_remove_undone_bom_state';
UPDATE _prisma_migrations SET migration_name = '20260424073752_inventory_hobby_relation'   WHERE migration_name = '20260424_inventory_hobby_relation';
UPDATE _prisma_migrations SET migration_name = '20260424150710_add_image_fk_indexes'       WHERE migration_name = '20260424_add_image_fk_indexes';
UPDATE _prisma_migrations SET migration_name = '20260427132023_add_idea_image'             WHERE migration_name = '20260427_add_idea_image';
UPDATE _prisma_migrations SET migration_name = '20260429151400_enable_rls_on_remaining_tables' WHERE migration_name = '20260429_enable_rls_on_remaining_tables';
UPDATE _prisma_migrations SET migration_name = '20260504153306_add_hours_tracking'         WHERE migration_name = '20260504_add_hours_tracking';
