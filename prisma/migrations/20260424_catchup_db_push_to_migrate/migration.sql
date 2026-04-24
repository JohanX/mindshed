-- Catch-up migration: captures all schema applied via `prisma db push` between
-- migration 20260406131603_add_step_image and now. Switching to `prisma migrate
-- deploy` going forward.

-- 1. Enums
CREATE TYPE "InventoryItemType" AS ENUM ('MATERIAL', 'CONSUMABLE', 'TOOL');
CREATE TYPE "BomConsumptionState" AS ENUM ('NOT_CONSUMED', 'CONSUMED', 'UNDONE');
CREATE TYPE "ReminderTargetType" AS ENUM ('STEP', 'PROJECT');

-- 2. New columns on existing tables
ALTER TABLE "blocker" ADD COLUMN "inventory_item_id" TEXT;

ALTER TABLE "project"
  ADD COLUMN "gallery_slug" TEXT,
  ADD COLUMN "journey_gallery_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "result_gallery_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "result_step_id" TEXT;

ALTER TABLE "step" ADD COLUMN "exclude_from_gallery" BOOLEAN NOT NULL DEFAULT false;

-- 3. New tables
CREATE TABLE "inventory_item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryItemType" NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "last_maintenance_date" TIMESTAMP(3),
    "maintenance_interval_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bom_item" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "inventory_item_id" TEXT,
    "label" TEXT,
    "required_quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "consumption_state" "BomConsumptionState" NOT NULL DEFAULT 'NOT_CONSUMED',
    "consumed_at" TIMESTAMP(3),
    "unconsumed_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bom_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reminder" (
    "id" TEXT NOT NULL,
    "target_type" "ReminderTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "snoozed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "setting_pkey" PRIMARY KEY ("key")
);

-- 4. Standard indexes
CREATE INDEX "reminder_target_type_target_id_idx" ON "reminder"("target_type", "target_id");
CREATE INDEX "reminder_due_date_idx" ON "reminder"("due_date");
CREATE INDEX "blocker_is_resolved_created_at_idx" ON "blocker"("is_resolved", "created_at");
CREATE UNIQUE INDEX "project_gallery_slug_key" ON "project"("gallery_slug");
CREATE UNIQUE INDEX "project_result_step_id_key" ON "project"("result_step_id");
CREATE INDEX "project_hobby_id_last_activity_at_idx" ON "project"("hobby_id", "last_activity_at");
CREATE INDEX "step_project_id_sort_order_idx" ON "step"("project_id", "sort_order");
CREATE INDEX "bom_item_project_id_sort_order_idx" ON "bom_item"("project_id", "sort_order");

-- 5. Foreign keys
ALTER TABLE "project" ADD CONSTRAINT "project_result_step_id_fkey"
  FOREIGN KEY ("result_step_id") REFERENCES "step"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "blocker" ADD CONSTRAINT "blocker_inventory_item_id_fkey"
  FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bom_item" ADD CONSTRAINT "bom_item_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bom_item" ADD CONSTRAINT "bom_item_inventory_item_id_fkey"
  FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Partial unique indexes (not expressible in schema.prisma)
CREATE UNIQUE INDEX "inventory_item_name_lower_unique"
  ON "inventory_item" (lower("name"))
  WHERE "is_deleted" = false;

CREATE UNIQUE INDEX "bom_item_project_inventory_unique"
  ON "bom_item" ("project_id", "inventory_item_id")
  WHERE "inventory_item_id" IS NOT NULL;

CREATE UNIQUE INDEX "blocker_step_inv_unresolved_unique"
  ON "blocker" ("step_id", "inventory_item_id")
  WHERE "is_resolved" = false AND "inventory_item_id" IS NOT NULL;

-- 7. Row Level Security (Supabase PostgREST hardening)
ALTER TABLE "hobby" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "step" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "step_note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blocker" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idea" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bom_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "step_image" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "setting" ENABLE ROW LEVEL SECURITY;
