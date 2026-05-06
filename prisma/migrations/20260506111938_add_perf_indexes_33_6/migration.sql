-- Story 33.6 — performance indexes for hot read paths.
--
-- Generated via `prisma migrate diff --from-migrations prisma/migrations
-- --to-schema prisma/schema.prisma --script` against the shadow database
-- (after the schema declarations were added in this story). Hand-applied
-- as a migration file because the dev DB carries unrelated `_prisma_migrations`
-- checksum drift from earlier rename work that would otherwise require a
-- full `prisma migrate reset` to satisfy `prisma migrate dev`.
--
-- Each index targets a specific query the static-analysis review identified:
--   1. Project (hobbyId, isArchived, isCompleted, lastActivityAt) — hobby
--      detail page's `WHERE hobbyId AND NOT isArchived AND NOT isCompleted
--      ORDER BY lastActivityAt DESC` query.
--   2. Project (isArchived, isCompleted, lastActivityAt) — dashboard's
--      `recentProjects` and `idleProjects` queries (no hobbyId filter, so
--      the hobbyId-leading composite above does NOT help).
--   3. StepImage (stepId, createdAt DESC) — `fetchLatestPhotosByProject`'s
--      `WHERE step.projectId IN (...) ORDER BY step_image.created_at DESC`
--      pattern, used by every project / dashboard card with thumbnails.
--   4. InventoryItem (isDeleted, type) — inventory list's
--      `WHERE isDeleted = false AND type = ?` filter.
--
-- The existing 2-col `Project (hobbyId, lastActivityAt)` from Story 18.2
-- stays in place; it serves queries that don't filter on the booleans.

-- CreateIndex
CREATE INDEX "inventory_item_is_deleted_type_idx" ON "inventory_item"("is_deleted", "type");

-- CreateIndex
CREATE INDEX "project_hobby_id_is_archived_is_completed_last_activity_at_idx" ON "project"("hobby_id", "is_archived", "is_completed", "last_activity_at");

-- CreateIndex
CREATE INDEX "project_is_archived_is_completed_last_activity_at_idx" ON "project"("is_archived", "is_completed", "last_activity_at");

-- CreateIndex
CREATE INDEX "step_image_step_id_created_at_idx" ON "step_image"("step_id", "created_at" DESC);
