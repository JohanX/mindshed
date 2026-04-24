import { getInventoryItems } from '@/actions/inventory'
import { getHobbies } from '@/actions/hobby'
import { PageHeader } from '@/components/layout/page-header'
import { CreateInventoryItemDialog } from '@/components/inventory/create-inventory-item-dialog'
import { InventoryFilterTabs } from '@/components/inventory/inventory-filter-tabs'
import { EmptyStateCard } from '@/components/empty-state-card'

export default async function InventoryPage() {
  const [itemsResult, hobbiesResult] = await Promise.all([getInventoryItems(), getHobbies()])
  const items = itemsResult.success ? itemsResult.data : []
  const hobbies = hobbiesResult.success
    ? hobbiesResult.data.map((h) => ({ id: h.id, name: h.name, color: h.color }))
    : []

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" breadcrumbs={[{ label: 'Inventory' }]}>
        <CreateInventoryItemDialog hobbies={hobbies} />
      </PageHeader>

      {items.length > 0 ? (
        <InventoryFilterTabs items={items} hobbies={hobbies} />
      ) : (
        <EmptyStateCard message="Your workshop inventory is empty. Add your first item to start tracking supplies.">
          <CreateInventoryItemDialog hobbies={hobbies} />
        </EmptyStateCard>
      )}
    </div>
  )
}
