# Background Job Scheduler

A background job processing system built with Node.js, Express, PostgreSQL, and Redis. Jobs are submitted via HTTP API, queued in an in-memory priority scheduler, executed by an independent worker process, and tracked through their full lifecycle. A React operations console provides live visibility and control.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 + TypeScript |
| API server | Express 4 |
| Database | PostgreSQL 16 (via `pg`) |
| Pub/sub | Redis (`ioredis`) |
| Validation | Zod v4 |
| Logging | Pino + pino-http |
| API docs | Swagger UI (`swagger-jsdoc`) |
| Testing | Vitest + Supertest |
| UI | React 19 + Vite + Tailwind CSS v4 |
| Package manager | pnpm (monorepo workspace) |

## Project Structure

```
job_scheduler/
├── src/
│   ├── config/          # App config and Swagger setup
│   ├── controllers/     # Route handler functions
│   ├── db/              # PostgreSQL client + all query methods
│   ├── events/          # Redis publisher and SSE subscriber
│   ├── middleware/       # Error handling middleware + AppError class
│   ├── routes/          # Express router definitions
│   ├── scripts/         # DB seeder, reset, and scheduler benchmark
│   ├── validation/      # Zod schemas for all endpoints
│   ├── worker/          # Worker process: scheduler, processor, handlers
│   │   ├── scheduler.ts           # MinHeap priority scheduler
│   │   ├── skip-list-scheduler.ts # Skip list scheduler (alternative)
│   │   ├── scheduler-interface.ts # Shared JobScheduler interface
│   │   ├── processor.ts           # Job execution + retry/DLQ logic
│   │   ├── worker.ts              # Poll loop + graceful shutdown
│   │   └── handlers/              # Job handler registry + implementations
│   ├── types.ts         # Shared TypeScript types
│   ├── utils.ts         # Scoring, interval helpers, backoff calculation
│   └── index.ts         # API server entry point
├── migrations/
│   ├── 001_init.sql     # Core schema: jobs, job_attempts, job_logs
│   └── 002_job_dependencies.sql  # DAG dependency table
├── tests/               # Vitest test suite
├── ui/                  # React frontend (separate workspace)
└── ARCHITECTURE.md      # Full system design document
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
pnpm install:ui
```

### Environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
NODE_ENV=development
PORT=3001
CORS_ORIGIN=*

JOB_SCHEDULER_DB_URL=postgresql://user:password@localhost:5432/job_scheduler_db

REDIS_URL=redis://localhost:6379
```

### Run migrations

```bash
psql $JOB_SCHEDULER_DB_URL -f migrations/001_init.sql
psql $JOB_SCHEDULER_DB_URL -f migrations/002_job_dependencies.sql
```

### Seed the database

```bash
pnpm seed:db
```

Inserts 120 jobs with varied types, priorities, scheduled times, and recurring intervals.

### Start development

Three processes, each in its own terminal:

```bash
pnpm dev:server   # API server  → http://localhost:3001
pnpm dev:worker   # Job worker process
pnpm dev:ui       # React UI    → http://localhost:5173
```

### API docs

```
http://localhost:3001/api-docs
```

Raw OpenAPI JSON (for Postman import):

```
http://localhost:3001/api-docs.json
```

---

## API Reference

All routes are prefixed with `/api/v1`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/jobs` | Create a new job |
| `GET` | `/jobs` | List jobs with filters and pagination |
| `GET` | `/jobs/stats` | Job counts by status |
| `GET` | `/jobs/dlq` | Dead-letter queue jobs |
| `GET` | `/jobs/:id` | Get a single job by ID |
| `GET` | `/jobs/:id/attempts` | Attempt history for a job |
| `POST` | `/jobs/:id/cancel` | Cancel a pending or processing job |
| `POST` | `/jobs/:id/retry` | Re-queue a DLQ job |
| `DELETE` | `/jobs/:id/purge` | Permanently delete a DLQ job |

### Create job — `POST /api/v1/jobs`

```json
{
  "type": "send_email",
  "payload": {
    "to": "user@example.com",
    "from": "noreply@example.com",
    "subject": "Welcome",
    "html": "<p>Hello</p>"
  },
  "priority": 1,
  "scheduled_at": 1749600000000,
  "recur_interval": "every_5_minutes",
  "depends_on": "3f7a1c2d-..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✓ | Handler type — must match a registered handler |
| `payload` | object | ✓ | Data the handler needs to execute |
| `priority` | `1\|2\|3` | ✓ | `1` = high, `2` = medium, `3` = low |
| `scheduled_at` | number | — | Unix ms timestamp; must be in the future if provided |
| `recur_interval` | string | — | `every_1_minute` / `every_5_minutes` / `every_1_hour` |
| `depends_on` | UUID | — | Job ID that must complete before this one runs |

### List jobs — `GET /api/v1/jobs`

Supports filtering by `status`, `priority`, `type`, `recur_interval`, and all timestamp range fields (`created_before/after`, `scheduled_before/after`, `started_before/after`, `completed_before/after`, `cancelled_before/after`, `next_retry_before/after`, `updated_before/after`). Sorting by `attempt_count`, `max_retries`, or `priority`. Pagination via `page` and `limit` (max 50).

---

## Job Lifecycle

```
pending → processing → completed
                    → failed (retrying, up to 3 attempts) → DLQ
                    → cancelled
```

- Failed jobs retry automatically with exponential backoff + jitter: ~1s, ~5s, ~25s
- After exhausting retries the job moves to the **dead-letter queue** (`status=failed`, `attempt_count >= max_retries`)
- DLQ jobs can be manually retried (`POST /jobs/:id/retry`) or purged (`DELETE /jobs/:id/purge`)
- Recurring jobs re-schedule automatically after each successful completion
- Jobs with a `depends_on` reference are invisible to the scheduler until the dependency reaches `completed`

---

## Scheduler

The worker uses an **in-memory priority scheduler** to determine which job runs next. Two implementations are provided behind a shared `JobScheduler` interface — they are drop-in replacements for each other.

### Score function

Both schedulers order jobs by an effective score that accounts for priority and waiting time:

```
score = max(0, priority - floor(minutesWaiting / 10) * 0.5)
```

Lower score = more urgent. A priority-3 job waiting 40 minutes reaches score 1.0 — the same urgency as a fresh priority-1 job. This prevents starvation.

### MinHeap (`src/worker/scheduler.ts`)

A binary min-heap stored as a flat array. The most urgent job is always at index 0. Insert and pop are both O(log n) via `siftUp`/`siftDown`. Cache-friendly due to contiguous memory layout. **This is what the worker uses.**

### SkipList (`src/worker/skip-list-scheduler.ts`)

A sorted linked list with 16 probabilistic express lanes (p=0.5 per level). The minimum is always at `head.forward[0]` — O(1) peek. Insert and pop are O(log n) expected. Slower in practice on insert due to per-node allocation and pointer indirection; significantly faster on drain since pop requires no sift traversal.

### Benchmark

Run against 1k, 5k, and 10k synthetic jobs (median of 7 runs):

```bash
pnpm benchmark
```

Results on this machine (Node.js v24):

| N | Operation | MinHeap | SkipList | Winner |
|---|---|---|---|---|
| 1,000 | insert | 1.07 ms | 2.98 ms | MinHeap |
| 1,000 | drain | 3.49 ms | 0.31 ms | SkipList |
| 5,000 | insert | 5.69 ms | 20.84 ms | MinHeap |
| 5,000 | drain | 30.24 ms | 0.31 ms | SkipList |
| 10,000 | insert | 13.67 ms | 48.85 ms | MinHeap |
| 10,000 | drain | 74.13 ms | 1.03 ms | SkipList |

MinHeap wins on insert (2–4×). SkipList wins on full drain (30–70×). The worker never fully drains the structure in a single pass — it pops one job per tick — so insert speed is what matters in practice.

---

## Worker

The worker runs as a separate Node.js process (`src/worker/index.ts`). It never shares memory with the API server — they communicate only through PostgreSQL and Redis.

On startup the worker:
1. Fetches all currently due jobs from the DB and loads them into the heap
2. Starts the **poll loop** — pops a job from the heap, claims it in the DB with `SELECT ... FOR UPDATE SKIP LOCKED`, and executes it
3. Starts the **heap feeder** (every 30s) — re-fetches due jobs to pick up anything created since startup
4. Starts the **cleanup loop** (every 5min) — resets jobs stuck in `processing` for more than 10 minutes back to `pending`

On `SIGTERM`/`SIGINT` the worker finishes its current job, stops accepting new ones, and exits cleanly.

---

## Live Updates (SSE)

The API server exposes a Server-Sent Events stream at `GET /api/jobs/stream`. The worker publishes all job lifecycle events to a Redis channel (`scheduler:events`); the API's subscriber fans them out to all connected SSE clients.

Event types: `job.created`, `job.started`, `job.completed`, `job.failed`, `job.cancelled`, `job.retry_scheduled`, `job.dlq_entry`, `stats.updated`.

---

## UI

The React operations console lives in `ui/`. It connects to the API over HTTP and opens one SSE connection per session to receive live updates without polling.

Pages:
- **Dashboard** — stat cards, active jobs stream, DLQ insight, node health, live log feed
- **Jobs Ledger** — filterable, paginated table of all jobs with cancel/retry actions
- **Create Job** — form to manually submit a job
- **DLQ Overview** — investigation queue with failure charts
- **DLQ Detail** — full job inspection: payload, stack trace, retry timeline, action buttons
- **Settings** — system config, display preferences, notification webhooks

---

## Development Commands

```bash
# Tests
pnpm test            # run once
pnpm test:watch      # watch mode

# Build
pnpm build:server    # compile TypeScript
pnpm build:ui        # build React app

# Database
pnpm seed:db         # seed 120 jobs
pnpm reset:db        # drop and recreate schema

# Benchmarks
pnpm benchmark       # MinHeap vs SkipList at 1k / 5k / 10k jobs

# Code quality
pnpm lint            # ESLint
pnpm format          # Prettier
pnpm validate        # lint + format + test + build (pre-push check)
```

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design: data flow diagrams, scheduling algorithm deep-dive, design decisions, and known tradeoffs.
