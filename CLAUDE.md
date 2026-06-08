@AGENTS.md

# General hard rules that must be followed

1. Ask, don't assume. If something is unclear, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements.
2. Simplest solution first. Always implement the simplest thing that could work. Do not add abstractions or flexibility that weren't explicitly requested.
3. Don't touch unrelated code. If a file or function is not directly part of the current task, do not modify it, even if you think it could be improved.
4. Flag uncertainty explicitly. If you are not confident about an approach or technical detail, say so before proceeding. Confidence without certainty causes more damage than admitting a gap.

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

## Issue tracking & PR workflow

**All new features and bugs are tracked as GitHub issues on the `JohanX/mindshed` repository.** Before starting work on a feature or bug, ensure a GitHub issue exists for it (create one via `gh issue create` if not). Reference the issue number in the branch name, commits, and PR.

**When the work corresponds to a BMad story, reference the epic and story number too.** The GitHub issue title should include the story identifier (e.g. `Story 34.1: <name>` or `<name> (Story 34.1)`), the issue body should link to the story file under `_bmad-output/implementation-artifacts/`, and the branch name must include the story id (see naming convention below). Use this form whenever the work has a corresponding BMad story; otherwise drop the story segment.

### Feature branches (required)

**Every new item — feature, bug fix, chore, refactor, docs — gets its own feature branch off `main`.** No work happens directly on `main`. The branch is short-lived: it exists only until its PR is merged, then it's deleted.

- Naming convention:
  - Without a BMad story: `<type>/issue-<N>-<short-slug>`
  - With a BMad story: `<type>/issue-<N>-story-<E>-<S>-<short-slug>` (use `-` not `.` between epic and story numbers, since `.` in branch names is awkward in some tooling)
  - `<type>` is one of `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`.
  - Examples: `feat/issue-42-story-34-1-step-time-logging`, `fix/issue-7-toast-mobile`, `chore/issue-12-claude-md-pr-policy`, `refactor/issue-25-story-33-2-non-tx-prisma-reads`.
- One branch per issue. If you discover unrelated work mid-branch, file a new issue and a new branch — don't bundle.
- Never reuse a branch name after merge; create a fresh one.
- The branch must be created from an up-to-date `main` (`git fetch origin && git checkout -b <branch> origin/main`).

**Every feature or story ships via a pull request — never directly to `main`.**

1. Branch off `main` with a descriptive name that references the issue (e.g. `feat/issue-42-step-time-logging`, `fix/issue-7-toast-mobile`).
2. Commit work to the branch and push to `origin` only (NOT `mindshed-vercel`).
3. Open a PR against `main` via `gh pr create`. Include a clear summary, link the issue (`Closes #N`), and a test plan.
4. **Wait for the user's explicit approval and merge instruction before merging.** Do NOT self-merge.
5. After the user confirms, merge the PR (squash or merge per user's preference) and delete the branch.
6. Update the submodule pointer in the root repo and commit it on root `main`.

**Push directly to `main` only when the user explicitly says so.** All other work goes through a PR. This applies to both `mindshed/` (origin + mindshed-vercel) and the root `aine-sdd-project` repo when it relates to a feature/bug rather than e.g. agent infrastructure.

### Production deploy (mindshed-vercel sync)

Vercel deploys from `mindshed-vercel`, which is NOT auto-synced from `mindshed`. After a PR merges into `mindshed/main` and the user is ready to ship to production, the user (or Claude when explicitly instructed) runs:

```sh
git -C mindshed checkout main
git -C mindshed pull origin main
git -C mindshed push mindshed-vercel main
```

This is a manual gate — merging a PR does NOT automatically deploy. Only push to `mindshed-vercel` when the user says "deploy" / "ship to prod" / equivalent.

## Story Workflow

Every story must follow this sequence:

1. Confirm a GitHub issue exists for the work; create one if missing.
2. Create a feature branch off `main`.
3. Invoke DEV agent to implement all tasks/subtasks in order
4. Invoke QA agent to write E2E tests and identify potential gaps (required for every story)
   - QA agent uses Playwright MCP server to interactively explore the running app before writing tests
   - QA navigates the feature, verifies behavior, identifies edge cases via live browser
   - Then writes E2E test scripts grounded in observed behavior
5. Switch back to DEV agent to execute rest of the steps
6. Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test run`, `pnpm build`
7. Run E2E tests
8. Run code review (bmad-code-review skill)
9. Auto-apply review patches (no pause for approval)
10. Re-run all tests after patches
11. Commit mindshed/ changes to the feature branch
12. Commit \_bmad-output/ changes separately
13. Push the feature branch to `origin` only
14. Open a PR against `main`, link the GitHub issue, wait for user approval before merging
15. After user approves and instructs merge: merge PR, update submodule pointer on root, push root only when instructed
16. Production deploy is a separate, explicit step — do not push to `mindshed-vercel` unless the user says so (see "Production deploy" above)

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
- **Video (Epic 35 / FR134, FR137):** `ImageStorageAdapter` exposes `getVideoUrl`, `getVideoPosterUrl` (returns `null` on S3 — UI renders generic play-icon card; Cloudinary derives via `so_auto` URL transform), and `mediaType` opts on `deleteObject` / `upload`. **Load-bearing footgun:** Cloudinary `destroy()` and `upload()` MUST receive `resource_type: 'video'` (via `{ mediaType: 'video' }`) for video assets — otherwise the SDK silently routes through the `image` pipeline and orphans the bytes. **Public-surface gate discipline:** every poster URL consumer on a server-rendered page (journey gallery, result gallery, dashboard galleries section, FR128 `generateMetadata`) routes through `resolveStepImagePosterUrl` (or the equivalent data-layer gate) — never call `adapter.getVideoPosterUrl` directly from a page component, since the helper gates on `mediaType === 'VIDEO'` + `type === 'UPLOAD'` so non-VIDEO rows can't accidentally mint a Cloudinary `so_auto` URL. See `_bmad-output/planning-artifacts/architecture.md` § "Image Storage Adapter — Video Methods" + "Public-Gallery Video Playback Policy" for the full contract.
- **Cloudinary direct upload (Story 35.5 / FR138):** Vercel's serverless edge rejects request bodies >4.5 MB at the platform level — `bodySizeLimit` in `next.config.ts` is unreachable. VIDEO uploads in Cloudinary mode therefore POST directly to `api.cloudinary.com` from the browser via `/api/upload/cloudinary-sign` (signature-only, no file bytes). IMAGE uploads keep the Server Action path. Any future upload >4.5 MB must use the browser-direct pattern. See `_bmad-output/planning-artifacts/architecture.md` § "Cloudinary Direct-Upload (Browser → Cloudinary, FR138)" + § "Vercel Platform Edge Body Limits".
- **Derived video thumbnails (Story 35.6 / FR139):** the `ProjectCard` "latest photo" thumbnail (dashboard Recent Projects, `/projects` index, hobby detail page project list) is mediaType-aware — derived thumbnails route through `adapter.getVideoPosterUrl` for VIDEO rows. Without this, `getThumbnailUrl(videoPublicId)` builds `/image/upload/<key>` URLs that 404 on Cloudinary (the 2026-05-15 prod regression). `fetchLatestPhotosByProject` widens its Prisma select to include `mediaType` + `type` + `url`; `resolveProjectThumbnailUrl` delegates the VIDEO gate to the canonical `resolveStepImagePosterUrl` helper in `data/image.ts`. No `<video>` element renders at thumbnail size on any surface — same hard rule as FR136/FR137.
