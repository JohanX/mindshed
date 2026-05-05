-- CreateTable
CREATE TABLE "idea_image" (
    "id" TEXT NOT NULL,
    "idea_id" TEXT NOT NULL,
    "storage_key" TEXT,
    "original_filename" TEXT,
    "content_type" TEXT,
    "size_bytes" INTEGER,
    "type" "StepImageType" NOT NULL DEFAULT 'UPLOAD',
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idea_image_idea_id_key" ON "idea_image"("idea_id");

-- AddForeignKey
ALTER TABLE "idea_image" ADD CONSTRAINT "idea_image_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
