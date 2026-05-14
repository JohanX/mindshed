-- CreateEnum
CREATE TYPE "StepMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "step_image" ADD COLUMN     "duration_seconds" INTEGER,
ADD COLUMN     "media_type" "StepMediaType" NOT NULL DEFAULT 'IMAGE';
