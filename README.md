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

# Run unit tests
pnpm test run

# Run E2E tests
pnpm test:e2e:chrome
```

## Production Deployment (Vercel)

### Prerequisites

- Vercel account
- PostgreSQL database — **Supabase** (recommended) or Neon
- Image storage — **Cloudinary** (recommended) or S3-compatible (Cloudflare R2)

### Option A: Cloudinary (Recommended for Images)

Cloudinary provides free-tier image hosting with CDN, auto-optimization, and permanent URLs. No CORS configuration needed.

1. Create a free [Cloudinary](https://cloudinary.com) account
2. Go to **Dashboard** and note your Cloud Name, API Key, and API Secret

### Option B: S3-Compatible (Cloudflare R2)

R2 provides S3-compatible storage with presigned URL uploads. Requires CORS configuration.

1. Create a Cloudflare R2 bucket
2. Configure CORS (see [R2 CORS Configuration](#r2-cors-configuration) below)
3. Create an API token with read/write access

### Database Setup

#### Supabase (Recommended)

1. Create a free [Supabase](https://supabase.com) project
2. Go to **Project Settings > Database** (or click **Connect**)
3. Copy two connection strings:
   - **Transaction pooler** (port 6543) — used as `DATABASE_URL` for the app runtime
   - **Direct connection** (port 5432) — used as `DIRECT_URL` for Prisma CLI / migrations

**Important:** Append `?pgbouncer=true&connection_limit=1` to the Transaction pooler URL.

#### Neon (Alternative)

1. Create a free [Neon](https://neon.tech) project
2. Copy the connection string as `DATABASE_URL`
3. Copy the direct (non-pooled) connection string as `DIRECT_URL`

### Deployment Steps

1. Fork this repository
2. Connect to Vercel
3. Set environment variables in Vercel:

**Required (all deployments):**
- `DATABASE_URL` — Postgres connection string (pooled, port 6543 for Supabase)
- `DIRECT_URL` — Postgres direct connection (port 5432, used for migrations)
- `APP_SECRET` — Random secret string for authentication

**For Cloudinary image storage:**
- `IMAGE_PROVIDER=cloudinary`
- `CLOUDINARY_CLOUD_NAME` — from Cloudinary Dashboard
- `CLOUDINARY_API_KEY` — from Cloudinary Dashboard
- `CLOUDINARY_API_SECRET` — from Cloudinary Dashboard

**For R2 image storage:**
- `IMAGE_PROVIDER=s3`
- `R2_ENDPOINT` — Cloudflare R2 endpoint
- `R2_ACCESS_KEY_ID` — R2 API token key ID
- `R2_SECRET_ACCESS_KEY` — R2 API token secret
- `R2_BUCKET_NAME` — R2 bucket name
- `R2_PUBLIC_URL` — Public URL for the R2 bucket

4. Deploy

### R2 CORS Configuration

Only needed if using R2 for image storage. Configure CORS on your R2 bucket:

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

- **Hobby categories** with dramatic per-hobby color theming
- **Project tracking** with configurable step workflows
- **Step states:** Not Started, In Progress, Completed, Blocked (bidirectional transitions)
- **Auto-derived project status** from step states
- **Blocker tracking** with automatic step state management
- **Notes** on every step with edit/delete
- **Image documentation** via Cloudinary upload or external URL
- **Camera capture** directly from the app
- **Ideation pipeline** — capture ideas, promote to projects
- **Dashboard** — recent projects, active blockers, idle projects, reminders, maintenance alerts
- **Public galleries** — share project journeys and finished results via public URLs
- **Inventory tracking** — materials, consumables, tools with blocker linkage
- **Reminders** — due dates on steps and projects with snooze
- **Equipment maintenance** — track maintenance schedules
- **Responsive** — works on mobile and desktop
- **Drag-and-drop** sorting for hobbies and steps

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 + shadcn/ui v4
- **Database:** PostgreSQL via Prisma 7 (Supabase/Neon in production, Docker locally)
- **Image Storage:** Cloudinary (recommended) or S3-compatible (R2, MinIO locally)
- **Testing:** Vitest + Playwright

## License

MIT
