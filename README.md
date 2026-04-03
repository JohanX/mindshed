# MindShed

A hobby project tracker for crafters and makers. Track projects across multiple hobbies, manage steps with blocker tracking, and never lose context on where you left off.

## Local Development

### Prerequisites

- Node.js 24.x (LTS)
- pnpm
- Docker & Docker Compose

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd mindshed
pnpm install

# 2. Start local services (Postgres + MinIO)
docker compose up -d

# 3. Configure environment
cp .env.example .env

# 4. Run database migrations
pnpm dlx prisma migrate dev

# 5. Create MinIO bucket
# Open http://localhost:9001 (MinIO Console)
# Login: mindshed / mindshed123
# Create bucket: mindshed-images

# 6. Start dev server
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
| `pnpm test:e2e` | Run Playwright E2E tests |

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

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL (Neon in production, Docker locally)
- **ORM:** Prisma
- **Object Storage:** S3-compatible (Cloudflare R2 in production, MinIO locally)
- **Testing:** Vitest + Playwright
