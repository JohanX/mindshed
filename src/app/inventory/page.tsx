import { getInventoryItems } from '@/actions/inventory'
import { PageHeader } from '@/components/layout/page-header'
import { CreateInventoryItemDialog } from '@/components/inventory/create-inventory-item-dialog'
import { InventoryFilterTabs } from '@/components/inventory/inventory-filter-tabs'
import { EmptyStateCard } from '@/components/empty-state-card'

export default async function InventoryPage() {
  const result = await getInventoryItems()
  const items = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        breadcrumbs={[{ label: 'Inventory' }]}
      >
        <CreateInventoryItemDialog />
      </PageHeader>

      {items.length > 0 ? (
        <InventoryFilterTabs items={items} />
      ) : (
        <EmptyStateCard message="Your workshop inventory is empty. Add your first item to start tracking supplies.">
          <CreateInventoryItemDialog />
        </EmptyStateCard>
      )}
    </div>
  )
}
