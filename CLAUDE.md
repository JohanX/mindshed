@AGENTS.md

# MindShed Development Guidelines

## Commands

- `pnpm test run` — unit tests (vitest)
- `pnpm lint` — eslint
- `pnpm build` — production build
- `pnpm test:e2e` — E2E tests (all browsers)
- `pnpm test:e2e:chrome` — E2E chromium only

Do NOT prefix PATH or use `pnpm exec` for things with scripts. Node and pnpm are in global PATH.

## Story Workflow

Every story must follow this sequence:

1. Invoke DEV agent to implement all tasks/subtasks in order
2. Invoke QA agent to write E2E tests and identify potential gaps (required for every story)
   - QA agent uses Playwright MCP server to interactively explore the running app before writing tests
   - QA navigates the feature, verifies behavior, identifies edge cases via live browser
   - Then writes E2E test scripts grounded in observed behavior
3. Switch back to DEV agent to execute rest of the steps
4. Run `pnpm lint`, `pnpm test run`, `pnpm build`
5. Run E2E tests
6. Run code review (bmad-code-review skill)
7. Auto-apply review patches (no pause for approval)
8. Re-run all tests after patches
9. Commit mindshed/ changes
10. Commit _bmad-output/ changes separately

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

## Architecture

- Next.js 16 App Router with Turbopack
- Prisma 7 with `@prisma/adapter-pg` + `PrismaPg` driver adapter (see `src/lib/db.ts`)
- `proxy.ts` not `middleware.ts` (Next.js 16 convention)
- Server components by default, `'use client'` only for interactivity
- Tailwind CSS v4 with oklch colors
- shadcn/ui v4 components in `src/components/ui/`

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
