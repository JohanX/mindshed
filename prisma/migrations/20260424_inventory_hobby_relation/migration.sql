-- Story 21.3: Hobby associations on inventory items.
-- Implicit many-to-many via Prisma convention join table.

CREATE TABLE "_HobbyToInventoryItem" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_HobbyToInventoryItem_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_HobbyToInventoryItem_B_index" ON "_HobbyToInventoryItem"("B");

ALTER TABLE "_HobbyToInventoryItem" ADD CONSTRAINT "_HobbyToInventoryItem_A_fkey" FOREIGN KEY ("A") REFERENCES "hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_HobbyToInventoryItem" ADD CONSTRAINT "_HobbyToInventoryItem_B_fkey" FOREIGN KEY ("B") REFERENCES "inventory_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
