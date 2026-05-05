# Manual SQL — `prisma/manual/`

This directory holds one-off SQL files that must be **manually applied to
production** (Supabase) outside of Prisma's normal `migrate deploy` flow.

## When to add a file here

Use this directory when a change cannot be expressed as a regular Prisma
migration, e.g.:

- Backfills that depend on prod data values rather than schema shape.
- Renaming entries in Prisma's own `_prisma_migrations` bookkeeping table
  (Prisma will not do this for you).
- Surgical fixes that have already been applied locally via `db push` /
  `migrate resolve` and need the same change in prod.

## File naming

`YYYY-MM-DD_short-description.sql` — date first, kebab-case description.

## Required header

Every file MUST open with a comment block stating:

1. The story or issue that introduced it.
2. Whether it must run **before** or **after** the next `prisma migrate deploy`.
3. Idempotency: every file must be safe to re-run (no-op on already-applied
   rows). This is non-negotiable — partial reruns happen when applying via
   the Supabase SQL editor across multiple environments.
4. The list of environments that need the change (Supabase prod, any
   preview database with its own `_prisma_migrations` row, etc.).

## How to apply

1. Open the Supabase project's SQL editor.
2. Paste the file's contents and run.
3. Verify the expected row count in the editor's output.
4. **Then** trigger the next deploy.

## Tracking

These files are committed for history but never deleted. They serve as the
audit trail for out-of-band changes.
