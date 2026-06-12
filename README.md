# Background Job Scheduler

A background job scheduler built with Node.js, Express, and PostgreSQL. Jobs are created via API, queued, processed by independent workers, and tracked through their full lifecycle.

## Stack

- **Runtime**: Node.js + TypeScript
- **Server**: Express 5
- **Database**: PostgreSQL (via `pg`)
- **Cache/Queue**: Redis (`ioredis`)
- **Validation**: Zod v4
- **API Docs**: Swagger UI (`swagger-jsdoc` + `swagger-ui-express`)
- **Testing**: Vitest + Supertest
- **Package manager**: pnpm (monorepo)

## Project Structure

```
job_scheduler/
├── src/
│   ├── config/          # Swagger config
│   ├── controllers/     # Route handlers
│   ├── db/              # PostgreSQL client and query methods
│   ├── middleware/       # Error handling middleware + AppError class
│   ├── routes/          # Express router
│   ├── validation/      # Zod schemas for all endpoints
│   ├── types.ts         # Shared TypeScript types
│   ├── utils.ts         # Validators, interval helpers
│   ├── seeder.ts        # DB seeder (120 randomised jobs)
│   └── index.ts         # App entry point
├── migrations/
│   └── 001_init.sql     # Schema + indexes
├── tests/               # Vitest test suite
└── ui/                  # React frontend (Vite)
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 16+
- Redis

### Install

```bash
pnpm install
```

### Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:

```
JOB_SCHEDULER_DB_URL=postgresql://user:password@localhost:5432/job_scheduler
PORT=3001
NODE_ENV=development
```

### Run migrations

```bash
psql $JOB_SCHEDULER_DB_URL -f migrations/001_init.sql
```

### Seed the database

```bash
pnpm seed
```

Inserts 120 jobs with varied types, priorities, scheduled times, and recurring intervals.

### Start the server

```bash
pnpm dev:server
```

### API docs

With the server running, open:

```
http://localhost:3001/api-docs
```

Raw OpenAPI JSON (for Postman import):

```
http://localhost:3001/api-docs.json
```

## API Endpoints

All routes are prefixed with `/api/v1`.

| Method | Path               | Description                           |
| ------ | ------------------ | ------------------------------------- |
| `POST` | `/jobs`            | Create a new job                      |
| `GET`  | `/jobs`            | List jobs with filters and pagination |
| `GET`  | `/jobs/stats`      | Job counts by status (dashboard)      |
| `GET`  | `/jobs/dlq`        | Dead-letter queue jobs                |
| `GET`  | `/jobs/:id`        | Get a single job by ID                |
| `POST` | `/jobs/:id/cancel` | Cancel a job                          |
| `POST` | `/jobs/:id/retry`  | Retry a DLQ job                       |

### Create job — `POST /api/v1/jobs`

```json
{
  "type": "send_email",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome"
  },
  "priority": 1,
  "scheduled_at": 1749600000000,
  "recur_interval": "every_5_minutes"
}
```

- `type` — required, string
- `payload` — required, JSON object
- `priority` — required, `1` (high) / `2` (medium) / `3` (low)
- `scheduled_at` — optional, unix ms timestamp (must be in the future)
- `recur_interval` — optional, one of `every_1_minute` / `every_5_minutes` / `every_1_hour`

### List jobs — `GET /api/v1/jobs`

Supports filtering by `status`, `priority`, `type`, `recur_interval`, all date range fields (`created_before`, `created_after`, etc.), and sorting by `attempt_count`, `max_retries`, or `priority`. Pagination via `page` and `limit` (max 50).

## Job Lifecycle

```
pending → processing → completed
                    → failed     → (retry) → ... → DLQ
                    → cancelled
```

- Failed jobs retry automatically up to 3 times with exponential backoff + jitter (~1s, ~5s, ~25s)
- After 3 failures the job is marked `failed` and moves to the dead-letter queue
- DLQ jobs can be manually retried from the UI or via `POST /jobs/:id/retry`
- Recurring jobs re-schedule themselves automatically after completion

## Development

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Type check
pnpm build:server --noEmit

# Format
pnpm format
```

## Current Status

### Done

- [x] PostgreSQL schema with indexes (partial index for worker polling, retry index)
- [x] `DatabaseClient` with `insertJob`, `getJob`, `getAllJobs`, `getJobStats`, `getDLQJobs`
- [x] REST API — `POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `GET /jobs/dlq`, `GET /jobs/stats` (stub)
- [x] Zod v4 validation schemas for all endpoints
- [x] Global error handling middleware + `AppError` class
- [x] Swagger UI with full OpenAPI spec
- [x] DB seeder (120 jobs, weighted type distribution)
- [x] GitHub Actions CI (build, type-check, test against real Postgres)
- [x] Unit tests — utils, all Zod schemas, `AppError`
- [x] pnpm monorepo setup (server + UI workspace)

### In progress / TODO

- [ ] `GET /jobs/stats` controller implementation
- [ ] `POST /jobs/:id/cancel` — pending + in-progress cancellation with `cancelling` status
- [ ] `POST /jobs/:id/retry` — DLQ manual retry
- [ ] Worker process — polls DB, processes jobs, handles retries, backoff, recurring scheduling
- [ ] Heap-based priority queue (required)
- [ ] Alternative scheduling algorithm (timing wheel / skip list / indexed priority queue)
- [ ] DAG job dependencies
- [ ] Starvation prevention (priority aging)
- [ ] Duplicate protection (`SELECT FOR UPDATE SKIP LOCKED`)
- [ ] DLQ threshold email alert
- [ ] Structured logging (every job lifecycle event)
- [ ] SSE / WebSocket / polling for live UI updates
- [ ] React UI (dashboard, jobs table, create form, DLQ view)
- [ ] Deployment — self-managed server, Nginx, HTTPS, dynamic DNS
