-- CreateEnum
CREATE TYPE "StepImageType" AS ENUM ('UPLOAD', 'LINK');

-- CreateTable
CREATE TABLE "step_image" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "storage_key" TEXT,
    "original_filename" TEXT,
    "content_type" TEXT,
    "size_bytes" INTEGER,
    "type" "StepImageType" NOT NULL DEFAULT 'UPLOAD',
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_image_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "step_image" ADD CONSTRAINT "step_image_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "step"("id") ON DELETE CASCADE ON UPDATE CASCADE;
