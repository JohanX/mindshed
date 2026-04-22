import { execSync } from 'child_process'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import path from 'path'
import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://mindshed:mindshed@localhost:5432/mindshed_test'

export default async function globalSetup() {
  // 0. Ensure auth state directory exists (required by Playwright storageState)
  const authDir = path.join(process.cwd(), 'e2e', '.auth')
  if (!existsSync(authDir)) {
    mkdirSync(authDir, { recursive: true })
  }
  const authFile = path.join(authDir, 'state.json')
  if (!existsSync(authFile)) {
    writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }))
    console.log('[e2e] Created initial auth state file.')
  }

  // 1. Push Prisma schema to the test database (idempotent — safe to run every time)
  console.log('[e2e] Pushing Prisma schema to test database...')
  execSync('pnpm exec prisma db push --accept-data-loss', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL },
    stdio: 'pipe',
  })

  // 2. Truncate all application tables (preserve schema, reset sequences)
  console.log('[e2e] Truncating test database tables...')
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    // Ensure the partial unique index on inventory_item(lower(name)) exists.
    // Prisma cannot express partial indexes in schema.prisma, so it is applied
    // here out-of-band. Drop-then-create guarantees the predicate always
    // matches the current definition — `IF NOT EXISTS` alone would silently
    // keep a stale index if the clause ever changes.
    await client.query('DROP INDEX IF EXISTS "inventory_item_name_lower_unique"')
    await client.query(`
      CREATE UNIQUE INDEX "inventory_item_name_lower_unique"
        ON "inventory_item" (lower("name"))
        WHERE "is_deleted" = false
    `)

    // Partial unique index for bom_item (Story 16.2). Drop-then-create so the
    // predicate always matches the current definition.
    await client.query('DROP INDEX IF EXISTS "bom_item_project_inventory_unique"')
    await client.query(`
      CREATE UNIQUE INDEX "bom_item_project_inventory_unique"
        ON "bom_item" ("project_id", "inventory_item_id")
        WHERE "inventory_item_id" IS NOT NULL
    `)

    // Partial unique index for blocker (Story 18.1) — mirrors post-push.mjs
    // so E2E tests exercise the same TOCTOU guard as production.
    await client.query('DROP INDEX IF EXISTS "blocker_step_inv_unresolved_unique"')
    await client.query(`
      CREATE UNIQUE INDEX "blocker_step_inv_unresolved_unique"
        ON "blocker" ("step_id", "inventory_item_id")
        WHERE "is_resolved" = false AND "inventory_item_id" IS NOT NULL
    `)

    await client.query(`
      TRUNCATE TABLE setting, reminder, bom_item, inventory_item, step_image, step_note, blocker, idea, step, project, hobby RESTART IDENTITY CASCADE
    `)
    console.log('[e2e] Test database ready — all tables truncated.')
  } finally {
    await client.end()
  }
}
