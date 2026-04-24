-- DropIndex
DROP INDEX "bom_item_project_id_sort_order_idx";

-- CreateTable
CREATE TABLE "inventory_item_image" (
    "id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "storage_key" TEXT,
    "original_filename" TEXT,
    "content_type" TEXT,
    "size_bytes" INTEGER,
    "type" "StepImageType" NOT NULL DEFAULT 'UPLOAD',
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_item_image_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "inventory_item_image" ADD CONSTRAINT "inventory_item_image_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
