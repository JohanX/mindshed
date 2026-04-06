-- AlterTable
ALTER TABLE "step" ADD COLUMN     "previous_state" "StepState";

-- CreateTable
CREATE TABLE "step_note" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocker" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea" (
    "id" TEXT NOT NULL,
    "hobby_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reference_link" TEXT,
    "is_promoted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "step_note" ADD CONSTRAINT "step_note_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocker" ADD CONSTRAINT "blocker_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea" ADD CONSTRAINT "idea_hobby_id_fkey" FOREIGN KEY ("hobby_id") REFERENCES "hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
