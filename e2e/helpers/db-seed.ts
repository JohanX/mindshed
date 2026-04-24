/**
 * E2E DB seed helpers.
 *
 * Seed test data via raw SQL (pg) instead of driving the UI — dramatically
 * faster and far less flaky than walking through forms. Mirrors the pattern
 * used by `e2e/global-setup.ts`.
 *
 * Use these in `beforeAll` blocks to prepare known state, then exercise the
 * feature under test via the UI. This keeps each spec's "interesting"
 * interactions focused and eliminates the sleep-ridden UI-setup boilerplate
 * the rescan flagged.
 */
import pg from 'pg'
import { randomUUID } from 'crypto'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://mindshed:mindshed@localhost:5432/mindshed_test'

// A single long-lived client per worker keeps connection overhead negligible
// across multiple seeds within a suite. Closed automatically on process exit.
let _client: pg.Client | null = null

async function getClient(): Promise<pg.Client> {
  if (_client) return _client
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  _client = client

  // Close the pg connection on worker shutdown so Playwright doesn't hang and
  // the test DB doesn't accumulate leaked sessions under CI retries.
  // `beforeExit` covers clean exits; SIGINT/SIGTERM cover Ctrl-C and
  // Playwright's force-kill on timeout.
  const shutdown = () => {
    _client = null
    client.end().catch(() => {})
  }
  process.once('beforeExit', shutdown)
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  return client
}

export interface SeededHobby {
  id: string
  name: string
  color: string
  icon: string | null
  sortOrder: number
}

export interface SeededProject {
  id: string
  hobbyId: string
  name: string
  description: string | null
}

export interface SeededStep {
  id: string
  projectId: string
  name: string
  state: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'
  sortOrder: number
}

/**
 * Insert a hobby directly via SQL. Returns the generated row.
 *
 * The color defaults to the Walnut palette entry (see HOBBY_COLORS). Caller
 * can override to disambiguate test hobbies visually when debugging.
 */
export async function seedHobby(opts: {
  name: string
  color?: string
  icon?: string | null
  sortOrder?: number
}): Promise<SeededHobby> {
  const client = await getClient()
  const id = randomUUID()
  const color = opts.color ?? 'hsl(25, 45%, 40%)' // Walnut
  const icon = opts.icon ?? null
  const sortOrder = opts.sortOrder ?? 0

  await client.query(
    `INSERT INTO hobby (id, name, color, icon, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())`,
    [id, opts.name, color, icon, sortOrder],
  )

  return { id, name: opts.name, color, icon, sortOrder }
}

/**
 * Insert a project directly via SQL. Optionally seeds steps in the same call
 * (one SQL round-trip each — cheap enough for E2E). Returns the created rows.
 *
 * `lastActivityAt` defaults to now so the project appears in Continue sections
 * without being flagged as idle. Override with `idleDaysAgo` to backdate for
 * idle-detection tests.
 *
 * **Caveat on seeded BLOCKED steps**: step.previous_state is left NULL on
 * every seeded step regardless of `state`. Production uses the blocker
 * workflow (createBlocker → step.state=BLOCKED with previous_state preserved)
 * to drive the restore-on-unblock behavior. If a test needs to exercise
 * unblock-restores-previousState, either transition the step via the UI first
 * or extend this helper to accept `previousState`.
 */
export async function seedProject(opts: {
  hobbyId: string
  name: string
  description?: string | null
  steps?: Array<{ name: string; state?: SeededStep['state'] }>
  idleDaysAgo?: number
}): Promise<{ project: SeededProject; steps: SeededStep[] }> {
  const client = await getClient()
  const id = randomUUID()
  const description = opts.description ?? null

  // Parameterize the interval offset so idleDaysAgo can't reach the SQL
  // string even via NaN/Infinity drift. `make_interval(days => $N::int)`
  // returns NULL for NaN input, which we then coalesce to 0 days (= now()).
  if (opts.idleDaysAgo !== undefined && !Number.isFinite(opts.idleDaysAgo)) {
    throw new Error(`seedProject: idleDaysAgo must be a finite number, got ${opts.idleDaysAgo}`)
  }
  const offsetDays = opts.idleDaysAgo ?? 0
  await client.query(
    `INSERT INTO project (id, hobby_id, name, description, last_activity_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now() - make_interval(days => $5::int), now(), now())`,
    [id, opts.hobbyId, opts.name, description, Math.trunc(offsetDays)],
  )

  const steps: SeededStep[] = []
  if (opts.steps?.length) {
    for (let i = 0; i < opts.steps.length; i++) {
      const s = opts.steps[i]
      const stepId = randomUUID()
      const state = s.state ?? 'NOT_STARTED'
      await client.query(
        `INSERT INTO step (id, project_id, name, state, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4::"StepState", $5, now(), now())`,
        [stepId, id, s.name, state, i],
      )
      steps.push({ id: stepId, projectId: id, name: s.name, state, sortOrder: i })
    }
  }

  return {
    project: { id, hobbyId: opts.hobbyId, name: opts.name, description },
    steps,
  }
}

export interface SeededInventoryItem {
  id: string
  name: string
  type: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
  quantity: number | null
  unit: string | null
}

export async function seedInventoryItem(opts: {
  name: string
  type?: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
  quantity?: number | null
  unit?: string | null
  hobbyIds?: string[]
}): Promise<SeededInventoryItem> {
  const client = await getClient()
  const id = randomUUID()
  const type = opts.type ?? 'MATERIAL'
  const quantity = opts.quantity ?? null
  const unit = opts.unit ?? null

  await client.query(
    `INSERT INTO inventory_item (id, name, type, quantity, unit, created_at, updated_at)
     VALUES ($1, $2, $3::"InventoryItemType", $4, $5, now(), now())`,
    [id, opts.name, type, quantity, unit],
  )

  if (opts.hobbyIds?.length) {
    for (const hobbyId of opts.hobbyIds) {
      await client.query(
        `INSERT INTO "_HobbyToInventoryItem" ("A", "B") VALUES ($1, $2)`,
        [hobbyId, id],
      )
    }
  }

  return { id, name: opts.name, type, quantity, unit }
}

export async function deleteInventoryItemsByPrefix(prefix: string): Promise<void> {
  const client = await getClient()
  await client.query(`DELETE FROM inventory_item WHERE name LIKE $1`, [`${prefix}%`])
}

/**
 * Hard-delete a hobby and let cascade tear down projects/steps/blockers/etc.
 * Prefer this in `afterAll` blocks over the UI delete flow — cleaner and
 * immune to UI regressions that would block cleanup.
 *
 * Also cleans up orphan reminders — Reminder.targetId is polymorphic with no
 * FK to Step/Project, so Postgres cascade doesn't reach them. Left behind,
 * they pollute the dashboard reminder badge in later specs.
 */
export async function deleteHobbyCascade(hobbyId: string): Promise<void> {
  const client = await getClient()
  // Collect targetIds that will be cascade-deleted (projects + their steps)
  // so we can remove their reminders in the same pass. Order matters: query
  // these BEFORE dropping the hobby.
  const { rows: projectRows } = await client.query<{ id: string }>(
    'SELECT id FROM project WHERE hobby_id = $1',
    [hobbyId],
  )
  const projectIds = projectRows.map((r) => r.id)
  // Note: Prisma maps `String` to Postgres TEXT columns — not `uuid`. Use
  // text[] in ANY() or Postgres will throw `operator does not exist: text = uuid`.
  const { rows: stepRows } = projectIds.length
    ? await client.query<{ id: string }>('SELECT id FROM step WHERE project_id = ANY($1::text[])', [
        projectIds,
      ])
    : { rows: [] }
  const stepIds = stepRows.map((r) => r.id)

  const targetIds = [...projectIds, ...stepIds]
  if (targetIds.length > 0) {
    // reminder.target_id is TEXT (polymorphic FK — no type constraint).
    await client.query('DELETE FROM reminder WHERE target_id = ANY($1::text[])', [targetIds])
  }
  await client.query('DELETE FROM hobby WHERE id = $1', [hobbyId])
}
