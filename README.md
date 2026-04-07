# MindShed

A hobby project tracker for crafters and makers. Track projects across multiple hobbies, manage steps with blocker tracking, capture ideas, and never lose context on where you left off.

## Quick Start (Docker)

Run everything locally in containers — no Node.js or dependencies required:

```bash
git clone git@github.com:JohanX/mindshed.git
cd mindshed
docker compose -f docker-compose.prod.yml up --build
```

Open http://localhost:3000?token=local-docker-secret to authenticate on the first visit.

## Local Development

### Prerequisites

- Node.js 24.x (LTS)
- pnpm
- Docker & Docker Compose

### Setup

```bash
# 1. Clone and install
git clone git@github.com:JohanX/mindshed.git
cd mindshed
pnpm install

# 2. Start local services (Postgres + MinIO)
docker compose up -d
# MinIO bucket is auto-created by the init service

# 3. Configure environment
cp .env.example .env

# 4. Run database migrations
pnpm dlx prisma migrate dev

# 5. Start dev server
pnpm dev
```

App runs at http://localhost:3000

### Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test run --coverage` | Unit tests with coverage report |
| `pnpm test:e2e` | Run Playwright E2E tests (all browsers) |
| `pnpm test:e2e:chrome` | Run Playwright E2E tests (Chromium only) |

### Testing

Tests use a separate database (`mindshed_test`) that is auto-truncated before each E2E run.

```bash
# Create .env.test for E2E
cp .env.test.example .env.test

# Run unit tests (301 tests)
pnpm test run

# Run E2E tests (56 tests)
pnpm test:e2e:chrome
```

## Production Deployment (Vercel)

### Prerequisites

- Vercel account
- Neon Postgres database (free tier)
- Cloudflare R2 bucket (free tier)

### Steps

1. Fork this repository
2. Connect to Vercel
3. Provision Neon Postgres via Vercel integration
4. Create Cloudflare R2 bucket with CORS configuration (see below)
5. Set environment variables in Vercel:
   - `DATABASE_URL` — Neon connection string
   - `R2_ENDPOINT` — Cloudflare R2 endpoint
   - `R2_ACCESS_KEY_ID` — R2 API token key ID
   - `R2_SECRET_ACCESS_KEY` — R2 API token secret
   - `R2_BUCKET_NAME` — R2 bucket name
   - `APP_SECRET` — Random secret string for auth
6. Deploy

### R2 CORS Configuration

For presigned URL image uploads, configure CORS on your R2 bucket:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.vercel.app"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## Features

- **Hobby categories** with color coding and icons
- **Project tracking** with configurable step workflows
- **Step states:** Not Started, In Progress, Completed, Blocked
- **Blocker tracking** with automatic step state management
- **Notes** on every step with edit/delete
- **Image documentation** via upload (S3/MinIO) or external URL
- **Ideation pipeline** — capture ideas, promote to projects
- **Dashboard** — recent projects, active blockers, idle project detection
- **Responsive** — works on mobile and desktop

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 + shadcn/ui v4
- **Database:** PostgreSQL via Prisma 7 (Neon in production, Docker locally)
- **Object Storage:** S3-compatible (Cloudflare R2 in production, MinIO locally)
- **Testing:** Vitest (301 unit tests) + Playwright (56 E2E tests)

## License

MIT
