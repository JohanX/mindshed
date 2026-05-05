-- Story 30.5 / FR129 — per-hobby step time tracking.
--
-- Both columns are non-destructive on existing rows:
--   - `hobby.hours_tracking_enabled` defaults to false; existing hobbies
--     opt out by default. Users opt in via the hobby form.
--   - `step.hours_logged` is nullable; existing steps have no logged time.
--     Inputs are validated server-side as 0.5-multiples in
--     `src/lib/schemas/step.ts` (`setStepHoursSchema`).

-- AlterTable
ALTER TABLE "hobby" ADD COLUMN     "hours_tracking_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "step" ADD COLUMN     "hours_logged" DECIMAL(5,1);
