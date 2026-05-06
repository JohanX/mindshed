@AGENTS.md

# MindShed Development Guidelines

## Commands

- `pnpm test run` — unit tests (vitest)
- `pnpm format` — prettier
- `pnpm lint` — eslint
- `pnpm typecheck` — `tsc --noEmit` over source AND test files (vitest does not enforce types on its own)
- `pnpm build` — production build
- `pnpm test:e2e` — E2E tests (all browsers)
- `pnpm test:e2e:chrome` — E2E chromium only

Do NOT prefix PATH or use `pnpm exec` for things with scripts. Node and pnpm are in global PATH.
Do NOT use compound commands with `cd directory && `.

# Version control

Root directory (`aine-sdd-project`) is a git repository. Origin remote is on github.
The `mindshed/` directory is a git submodule. It has two remotes: `origin` and `mindshed-vercel`.

## Story Workflow

Every story must follow this sequence:

1. Invoke DEV agent to implement all tasks/subtasks in order
2. Invoke QA agent to write E2E tests and identify potential gaps (required for every story)
   - QA agent uses Playwright MCP server to interactively explore the running app before writing tests
   - QA navigates the feature, verifies behavior, identifies edge cases via live browser
   - Then writes E2E test scripts grounded in observed behavior
3. Switch back to DEV agent to execute rest of the steps
4. Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test run`, `pnpm build`
5. Run E2E tests
6. Run code review (bmad-code-review skill)
7. Auto-apply review patches (no pause for approval)
8. Re-run all tests after patches
9. Commit mindshed/ changes
10. Commit \_bmad-output/ changes separately
11. Push to git remotes

## Type-check gate strategy

Two gates protect against TypeScript errors. Neither alone is sufficient; both
together cover source AND test files at the right times.

**Gate 1 — Pre-commit (Husky).** `pnpm typecheck && pnpm lint` runs in
`mindshed/.husky/pre-commit` with `set -e`. Catches type errors in BOTH
source and test files before commits land. The canonical gate for test
types — Vercel can't catch those (see gate 2 below).

**Gate 2 — Vercel build (`next build`).** Next.js's bundled-files type
check runs as part of `next build` (default behavior; `next.config.ts`
deliberately does NOT set `typescript.ignoreBuildErrors`). Catches type
errors in any source file that ships to production. Test files are NOT
in the bundle, so test-only type errors slip past gate 2 — but gate 1
catches them locally.

**Why this layout (not three gates).** The `build` script previously included
`pnpm typecheck` as a third gate (re-checking source + tests on every
Vercel build). Removed in Story 33.4 — duplicate of gate 2 for prod-bound
code, and runs on test files for no production benefit. The combination
of gate 1 + gate 2 is sufficient.

**Escape valve.** `git commit --no-verify` bypasses gate 1. Pushing such
a commit means test-only type errors won't be caught by Vercel either.
That's the developer's footgun; don't `--no-verify` casually.

## Code Conventions

- **Imports:** `zod/v4` (not `zod`), `z.uuid()` (not `z.string().uuid()`)
- **Files:** kebab-case everywhere (`step-card.tsx`, not `StepCard.tsx`)
- **Server actions:** Return `ActionResult<T>` from `@/lib/action-result`, never throw
- **Validation:** Zod schemas in `src/lib/schemas/`, use `safeParse` not `parse`
- **Mutations:** Wrap multi-step writes in `prisma.$transaction()`
- **Activity tracking:** Every step/note/image/blocker mutation must update parent project's `lastActivityAt`
- **Completed projects:** All mutation actions must check `project.isCompleted` and reject if true
- **Revalidation:** Call `revalidatePath()` after mutations, no optimistic updates
- **Client components:** Use `useTransition` for pending state, `key` prop for remounting on prop changes (no setState in useEffect)
- **Touch targets:** Minimum 44px on all interactive elements
- **Accessibility:** `aria-label` on icon-only buttons, `aria-expanded` on expand/collapse, `aria-describedby` for error messages
- **Variables:** ALWAYS use meaningful names that describe the value — no single letters and no abbreviations (`inv` → `inventoryItem`, `proj` → `project`, `req` → `request`). For loop iterators, use the singular noun of the collection (`hobbies.map(hobby => ...)`, not `(h => ...)`). For setState updaters, use `prev` (`setCount((prev) => prev + 1)`). For date predicates, use `date` (`disabled={(date) => date < today}`). Exceptions where short names are allowed: `(a, b)` in sort comparators; `(e)` for React/DOM event handlers; `_` for unused params; `i` as a numeric array index.

## Architecture

- Next.js 16 App Router with Turbopack
- Prisma 7 with `@prisma/adapter-pg` + `PrismaPg` driver adapter (see `src/lib/db.ts`)
- `proxy.ts` not `middleware.ts` (Next.js 16 convention)
- Server components by default, `'use client'` only for interactivity
- Tailwind CSS v4 with oklch colors
- shadcn/ui v4 components in `src/components/ui/`

## Prisma Migrations

- **Folder naming:** every migration folder MUST use the full `YYYYMMDDHHMMSS_<name>` timestamp prefix that `prisma migrate dev` produces by default. Date-only prefixes (`YYYYMMDD_<name>`) sort incorrectly against full timestamps when the shadow DB replays migrations and trigger `P3006`. See Story 31.1 for the historical fix.
- **Out-of-band SQL:** anything that cannot be applied via `prisma migrate deploy` (data backfills, fixes to `_prisma_migrations` itself, etc.) lives in `prisma/manual/YYYY-MM-DD_<description>.sql`. Files must be idempotent and document whether they run before or after the next `migrate deploy`. See `prisma/manual/README.md`.
- **Schema parity contract:** `prisma/schema.prisma` is the source of truth. Every `@@index`, `@@unique`, and column declaration must match the end-state of the migration history. Drift artifacts (e.g., a `CREATE INDEX` issued by an old migration but not declared in the schema) cause every subsequent `prisma migrate dev` to auto-generate a `DROP INDEX` to "fix" the perceived divergence — which then ships a regression. If you find drift, declare the missing thing in `schema.prisma` first, then verify the next `prisma migrate dev --create-only` produces an empty migration. See Story 33.3.
- **Partial-unique-index exception:** Prisma's `@@index` doesn't support `WHERE` clauses, so partial-unique indexes live in `prisma/post-push.mjs` (applied after `prisma db push` in dev) and inside the migration files (applied by `prisma migrate deploy` in prod). They are a documented exception to the parity contract — `prisma migrate diff` will always report them as missing from the schema; that's expected.

## Testing

- Separate test DB (`mindshed_test`) — auto-truncated before each E2E run via `e2e/global-setup.ts`
- E2E server runs on port 3001 (`.env.test`), never reuses dev server
- E2E hobby/project names use unique prefixes per browser (`PM-chromium-{timestamp}`) to avoid cross-browser interference
- Vitest excludes `e2e/` and `.claude/` directories
- Mock Prisma with `vi.mock('@/lib/db')` + `$transaction` pattern for action tests

## Image Storage

- R2/MinIO with presigned URL pattern: client → `/api/upload/presign` → PUT to storage
- `src/lib/r2.ts` — S3Client, `getPublicUrl()`, `deleteObject()`
- Docker `minio-init` service auto-creates bucket with CORS
- Use `<img>` not `next/image` for MinIO URLs (private IP block in dev)
