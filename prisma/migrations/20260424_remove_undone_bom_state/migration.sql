-- Story 21.1: Eliminate UNDONE BomConsumptionState.
-- Undo now resets to NOT_CONSUMED instead of the terminal UNDONE state.

-- 1. Migrate any existing UNDONE rows to NOT_CONSUMED
UPDATE "bom_item" SET "consumption_state" = 'NOT_CONSUMED' WHERE "consumption_state" = 'UNDONE';

-- 2. PostgreSQL cannot DROP a value from an enum. Rename-create-cast-drop dance.
ALTER TYPE "BomConsumptionState" RENAME TO "BomConsumptionState_old";
CREATE TYPE "BomConsumptionState" AS ENUM ('NOT_CONSUMED', 'CONSUMED');
ALTER TABLE "bom_item" ALTER COLUMN "consumption_state" DROP DEFAULT;
ALTER TABLE "bom_item" ALTER COLUMN "consumption_state" TYPE "BomConsumptionState" USING "consumption_state"::text::"BomConsumptionState";
ALTER TABLE "bom_item" ALTER COLUMN "consumption_state" SET DEFAULT 'NOT_CONSUMED'::"BomConsumptionState";
DROP TYPE "BomConsumptionState_old";
