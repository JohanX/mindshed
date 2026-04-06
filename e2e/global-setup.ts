import { execSync } from 'child_process'
import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://mindshed:mindshed@localhost:5432/mindshed_test'

export default async function globalSetup() {
  // 1. Push Prisma schema to the test database (idempotent — safe to run every time)
  console.log('[e2e] Pushing Prisma schema to test database...')
  execSync('pnpm exec prisma db push', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL },
    stdio: 'pipe',
  })

  // 2. Truncate all application tables (preserve schema, reset sequences)
  console.log('[e2e] Truncating test database tables...')
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    await client.query(`
      TRUNCATE TABLE step, project, hobby RESTART IDENTITY CASCADE
    `)
    console.log('[e2e] Test database ready — all tables truncated.')
  } finally {
    await client.end()
  }
}
