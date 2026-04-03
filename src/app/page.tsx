import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StepStateBadge } from '@/components/step-state-badge'
import { STEP_STATES } from '@/lib/step-states'
import { ToastDemo } from '@/components/toast-demo'

export default function ThemeShowcase() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-semibold">MindShed — Warm Workshop Theme</h1>

      {/* Color Tokens */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Color Tokens</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 rounded-lg bg-background border flex items-center justify-center text-sm">background</div>
          <div className="h-16 rounded-lg bg-card border flex items-center justify-center text-sm">card</div>
          <div className="h-16 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">muted</div>
          <div className="h-16 rounded-lg bg-primary flex items-center justify-center text-sm text-primary-foreground">primary</div>
          <div className="h-16 rounded-lg bg-secondary flex items-center justify-center text-sm text-secondary-foreground">secondary</div>
          <div className="h-16 rounded-lg bg-accent flex items-center justify-center text-sm text-accent-foreground">accent</div>
          <div className="h-16 rounded-lg bg-destructive flex items-center justify-center text-sm text-destructive-foreground">destructive</div>
          <div className="h-16 rounded-lg bg-foreground flex items-center justify-center text-sm text-background">foreground</div>
          <div className="h-16 rounded-lg border-2 border-border flex items-center justify-center text-sm">border</div>
        </div>
      </section>

      {/* Typography Scale */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Typography Scale</h2>
        <div className="space-y-2">
          <p className="text-2xl font-semibold">Page Title (text-2xl / 24px / semibold)</p>
          <p className="text-xl font-semibold">Section Header (text-xl / 20px / semibold)</p>
          <p className="text-lg font-medium">Card Title (text-lg / 18px / medium)</p>
          <p className="text-base font-normal">Body text (text-base / 16px / normal)</p>
          <p className="text-sm font-normal text-muted-foreground">Caption (text-sm / 14px / normal)</p>
          <p className="text-xs font-medium">Badge/Small (text-xs / 12px / medium)</p>
        </div>
      </section>

      {/* Step State Badges */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Step State Badges</h2>
        <div className="flex flex-wrap gap-3">
          <StepStateBadge state={STEP_STATES.NOT_STARTED} />
          <StepStateBadge state={STEP_STATES.IN_PROGRESS} />
          <StepStateBadge state={STEP_STATES.COMPLETED} />
          <StepStateBadge state={STEP_STATES.BLOCKED} />
        </div>
        <div className="flex flex-wrap gap-3">
          <StepStateBadge state={STEP_STATES.NOT_STARTED} size="sm" />
          <StepStateBadge state={STEP_STATES.IN_PROGRESS} size="sm" />
          <StepStateBadge state={STEP_STATES.COMPLETED} size="sm" />
          <StepStateBadge state={STEP_STATES.BLOCKED} size="sm" />
        </div>
      </section>

      {/* Card Example */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Card (12px radius, 1px border, no shadow)</h2>
        <Card>
          <CardHeader>
            <CardTitle>Walnut Side Table</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Assembly step — waiting for danish oil</p>
            <div className="mt-3">
              <StepStateBadge state={STEP_STATES.BLOCKED} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Spacing */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Spacing Scale (4px base)</h2>
        <div className="space-y-2">
          {[1, 2, 3, 4, 6, 8, 12].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-20">space-{n}</span>
              <div className="bg-primary h-3" style={{ width: `${n * 16}px` }} />
              <span className="text-xs text-muted-foreground">{n * 4}px</span>
            </div>
          ))}
        </div>
      </section>

      {/* Buttons */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </section>

      {/* Toast Demo */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Toast Feedback</h2>
        <ToastDemo />
      </section>
    </main>
  )
}
