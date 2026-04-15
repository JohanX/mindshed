import { BrainIcon } from '@/components/icons/brain-icon'

export function MobileBrand() {
  return (
    <div
      className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none lg:hidden"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-2 opacity-[0.04] dark:opacity-[0.06] text-foreground">
        <BrainIcon className="h-24 w-24" />
        <span className="text-2xl font-bold tracking-tight">MindShed</span>
      </div>
    </div>
  )
}
