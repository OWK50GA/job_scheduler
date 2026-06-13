# Background Job Scheduler System

**Company:** Dilamme Labs
**Author:** Wilfrid Okorie

---

## 1.0 OVERVIEW

This document describes the architecture of a background job scheduler built for Dilamme's internal infrastructure. The scheduler accepts jobs via HTTP, processes them asynchronously via independent workers, handles failures and retries automatically, and exposes a user interface for visibility and control. The system is designed for correctness under failure.

---

## 2.0 Requirements

### 2.1 Functional Requirements

| Property            | Description                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Job properties      | Jobs have a `type`, `payload`, `priority` (1 = high, 2 = medium, 3 = low), `scheduled_at` timestamp, and an optional `recur_interval`                                                                                                      |
| Job statuses        | Jobs move through the `pending → processing → completed / failed / cancelled` chain. Jobs can be cancelled whether they are pending or already processing                                                                                  |
| Worker process      | Workers run as a separate Node.js process from the API, launched independently via a dedicated entry point                                                                                                                                 |
| Automatic job retry | Jobs retry up to 3 times on failure. Backoff is exponential with jitter: attempt 1 ≈ 1 s, attempt 2 ≈ 5 s, attempt 3 ≈ 25 s (±20%)                                                                                                         |
| Dead-letter queue   | After exhausting all retries, a job's `attempt_count` reaches `max_retries` and its status is set to `failed`. These jobs form the DLQ — queryable as `status = 'failed' AND attempt_count >= max_retries`                                 |
| Manual retry        | The DLQ view in the UI provides a manual retry button. This resets `attempt_count` to 0 and sets `status` back to `pending` so the worker picks it up again                                                                                |
| DLQ threshold alert | An email alert is sent automatically when the DLQ count crosses a configured threshold. The threshold is defined in application configuration                                                                                              |
| Scheduled jobs      | Jobs with a future `scheduled_at` value are not eligible for execution until that time has passed. The worker's eligibility query enforces this at the database layer                                                                      |
| Recurring jobs      | When a recurring job completes successfully, the processor immediately inserts a new `pending` job with `scheduled_at = now + recur_interval`. Supported intervals: `every_1_minute`, `every_5_minutes`, `every_1_hour`                    |
| Job dependencies    | Jobs can declare a `depends_on` relationship via the `job_dependencies` table. A job with unmet dependencies is never inserted into the scheduling heap and is skipped during DB eligibility checks — regardless of its own `scheduled_at` |
| Job cancellation    | Pending jobs are cancelled immediately via a status update. Processing jobs receive a `cancelling` transition: the worker detects the cancellation flag on the next re-fetch and completes the cancellation cleanly                        |
| Live UI updates     | The UI receives job lifecycle events over Server-Sent Events (SSE). A single persistent connection per browser session receives all event types. No page refresh is required for status changes                                            |
| Job lock            | A job cannot be claimed by two workers simultaneously. Atomicity is enforced at the database layer using `SELECT ... FOR UPDATE SKIP LOCKED` within a transaction                                                                          |

### 2.2 Non-Functional Requirements

| Property              | Target                                                                                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate protection  | Guaranteed via PostgreSQL row-level locking (`FOR UPDATE SKIP LOCKED`). A job row locked by one worker is invisible to all other workers attempting the same claim                                                                                             |
| Zombie job recovery   | Jobs stuck in `processing` for more than 10 minutes are detected by a cleanup loop running every 5 minutes. These jobs are reset to `pending` and their `attempt_count` is incremented                                                                         |
| Worker isolation      | The worker is a separate OS process (`src/worker/index.ts`) started independently from the API server (`src/index.ts`). They share only the database                                                                                                           |
| Scheduling accuracy   | The heap feeder loop re-fetches due jobs from the database every 30 seconds, ensuring newly created jobs are visible to the in-memory scheduler within that window. The poll loop runs without sleep when jobs are available, draining the queue at full speed |
| Starvation prevention | The min-heap uses an effective-score function that applies aging. Every 10 minutes a low-priority job waits, its effective score decreases by 0.5. A priority-3 job waiting 40 minutes has the same urgency as a freshly created priority-1 job                |
| Observability         | Every significant state transition is written to the `job_logs` table and to stdout as a structured Pino JSON log line. Events include: `job_created`, `job_started`, `job_completed`, `job_failed`, `job_cancelled`, `retry_attempted`, `zombie_reaped`       |

---

## 3.0 Architecture

The system consists of three independently deployed processes that communicate exclusively through PostgreSQL. The API process accepts HTTP requests and writes job rows. The worker process reads those rows, executes handlers, and writes results. The React UI talks to the API over HTTP and receives live updates from the API's SSE endpoint, which is fed by a Redis pub/sub channel that the worker publishes to.

There is no message queue between the API and the worker. PostgreSQL is the queue. This eliminates an entire category of operational complexity at the cost of some throughput ceiling, which is acceptable for this workload.

### 3.1 Components

| Component          | Role                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Express API        | Accepts job creation, cancellation, manual retry, and status query requests. Validates input with Zod, writes to PostgreSQL, and returns immediately — it never waits for job execution. Also hosts the SSE stream endpoint that pushes events to the UI                                                                                                       |
| PostgreSQL DB      | Single source of truth for all job state. Three tables: `jobs` (primary), `job_attempts` (one row per execution attempt), `job_logs` (audit trail). Partial indexes on the `jobs` table keep worker polling fast even at large row counts                                                                                                                      |
| Worker process     | Separate Node.js process. Runs a poll loop that, on each tick, pops a job ID from the in-memory heap, claims it in the DB atomically, and delegates it to the job processor. Starts the cleanup loop and heap feeder loop on startup. Handles `SIGTERM` and `SIGINT` for graceful shutdown                                                                     |
| Heap scheduler     | A binary min-heap (`MinHeap` class in `src/worker/scheduler.ts`) inside the worker. Stores `Job` objects, ordered by an effective-score function that accounts for `priority`, `scheduled_at`, `created_at`, and aging. `inHeap: Set<string>` provides O(1) duplicate detection so the heap feeder loop can safely call `insert()` without creating duplicates |
| Job processor      | `processJob()` in `src/worker/processor.ts`. Takes one claimed `Job`, checks for cancellation and dependency status, calls the correct handler from the registry, and writes the outcome back to the DB. Manages all retry and DLQ transitions. Publishes SSE events to Redis after every state change                                                         |
| Handler registry   | A plain object (`HANDLERS`) mapping job type strings to handler functions. Currently registers `send_email`. Jobs with unregistered types are immediately dead-lettered without consuming a retry attempt                                                                                                                                                      |
| Send-email handler | The only implemented handler. Validates the payload with Zod (requires `to`, `from`, `subject`, `html`). Simulates a real SMTP call with a 500 ms delay and a 10% random failure rate, returning a typed `HandlerResult` — it never throws                                                                                                                     |
| Cleanup loop       | `setInterval` at 5-minute intervals. Calls `reapZombieJobs()` on the DB client, which resets any job stuck in `processing` for more than 10 minutes back to `pending` and increments `attempt_count`                                                                                                                                                           |
| Heap feeder loop   | `setInterval` at 30-second intervals. Calls `fetchDueJobs()` and passes the result to `heap.insert()`. Ensures jobs created after the initial heap load are picked up without restarting the worker                                                                                                                                                            |
| Redis pub/sub      | The worker and API publish scheduler events to a single Redis channel (`scheduler:events`) using ioredis. The API process maintains a dedicated subscriber connection that fans received messages out to all connected SSE clients                                                                                                                             |
| React UI           | Single-page application (React 19 + Vite). Opens one SSE connection per browser session at app root and distributes events to page components via a React context. Shows a live dashboard, filterable jobs ledger, DLQ investigation view, and job creation form                                                                                               |

### 3.2 Architecture Diagram

```
┌─────────────┐    HTTP     ┌──────────────────────────────────────────────┐
│             │ ──────────► │                 Express API                  │
│  React UI   │             │  POST /jobs   GET /jobs   POST /jobs/:id/*  │
│  (Browser)  │ ◄────────── │  GET /api/v1/events/stream (SSE)            │
│             │   SSE       └──────────────────┬─────────────────┬────────┘
└─────────────┘                                │ SQL             │ SUB
                                               │                 │
                                    ┌──────────▼──────┐  ┌──────▼──────┐
                                    │   PostgreSQL    │  │    Redis    │
                                    │                 │  │  pub/sub    │
                                    │  jobs           │  │             │
                                    │  job_attempts   │  │  scheduler  │
                                    │  job_logs       │  │  :events    │
                                    │  job_deps       │  └──────▲──────┘
                                    └──────────▲──────┘         │ PUB
                                               │ SQL             │
                                    ┌──────────┴─────────────────┴────────┐
                                    │              Worker Process          │
                                    │                                      │
                                    │  Poll loop ──► MinHeap ──► Processor │
                                    │                                      │
                                    │  Cleanup loop  (every 5 min)        │
                                    │  Heap feeder   (every 30 s)         │
                                    └──────────────────────────────────────┘
```

---

## 4.0 Data Flow

### 4.1 Job Creation

1. Client sends `POST /api/v1/jobs` with `type`, `payload`, `priority`, and optionally `scheduled_at` (Unix ms) and `recur_interval`
2. API validates the request body using Zod. If `depends_on` is provided, the referenced job is verified to exist
3. API inserts a row into `jobs` with `status = 'pending'`. If `depends_on` is present, a row is also inserted into `job_dependencies`
4. API publishes a `job.created` event to Redis and returns `{ status: "success", data: job }` with HTTP 201 — immediately, without waiting for execution
5. The worker's next heap feeder tick (within 30 s) calls `fetchDueJobs()`. If the new job is due and has no unmet dependencies, it is inserted into the heap

### 4.2 Job Scheduling (Heap path)

On each poll loop tick:

1. If the heap is empty, `loadDueJobs()` runs `fetchDueJobs()` against the DB. This query selects `pending` jobs where `scheduled_at <= NOW()` and `next_retry_at IS NULL OR next_retry_at <= NOW()`, and excludes jobs with any dependency in a non-`completed` state. Results are ordered by `priority ASC, scheduled_at ASC, created_at ASC`
2. The batch is passed to `heap.insert()`. Duplicate IDs (already in the heap) are silently skipped via the `inHeap` set
3. `heap.pop()` returns the job with the lowest effective score. The score is computed at pop time: `score = max(0, priority - floor(minutesWaiting / 10) * 0.5)`. Aging means a priority-3 job waiting 40 minutes has score 1.0 — same urgency as a fresh priority-1 job
4. The worker calls `claimJobById(jobId)`, which opens a transaction and attempts `SELECT ... FOR UPDATE SKIP LOCKED` on that specific row. If the row is locked (claimed by another worker) or no longer `pending`, the claim returns `null` and the tick continues without processing
5. On a successful claim, the job's status is updated to `processing` and `started_at` is set within the same transaction

### 4.3 Job Scheduling (Alternative mechanism)

_Section reserved. The alternative scheduling algorithm implementation is pending._

### 4.4 Job Execution (happy path)

1. `processJob(job)` is called with the claimed job
2. The processor re-fetches the job from the DB to catch any cancellation that arrived after the claim
3. The dependency gate runs: `checkDependenciesMet(jobId)` queries `job_dependencies` for any linked job not in `completed` status. If unmet, the job is released back to `pending` with a 5-second backoff
4. `logJobEvent` writes a `job_started` entry to `job_logs` and stdout. A `job.started` SSE event is published to Redis
5. The handler is called: `sendEmailHandler(job)` validates the payload, simulates the SMTP call (500 ms), and returns `{ success: true, result: { messageId } }`
6. The processor calls `markJobCompleted(jobId, result, durationMs)`, which sets `status = 'completed'`, records `completed_at`, increments `attempt_count`, and inserts a row into `job_attempts`
7. `logJobEvent` writes `job_completed`. A `job.completed` SSE event and a `stats.updated` event are published to Redis
8. If `recur_interval` is set, `scheduleNextRecurringRun(job)` inserts a new `pending` job row with `scheduled_at = now + interval`. A `job.created` event is published for the new job

### 4.5 Failure and Retry path

1. The handler returns `{ success: false, error: "SMTP connection timeout..." }` — it never throws
2. The processor checks `attempt_count + 1 >= max_retries`:
   - **Retries remaining:** calls `markJobRetryable(jobId, error, nextRetryAt, durationMs)`. This sets `status = 'pending'`, increments `attempt_count`, sets `last_error` and `next_retry_at` (backoff: 1 s / 5 s / 25 s ±20% jitter), and inserts into `job_attempts`. A `job.retry_scheduled` event is published. The job re-enters the heap on the next feeder tick once `next_retry_at` has elapsed
   - **Retries exhausted:** calls `markJobDeadLetter(jobId, error, durationMs)`. This sets `status = 'failed'`, sets `attempt_count = max_retries`, clears `next_retry_at`, and inserts into `job_attempts`. Both `job.failed` and `job.dlq_entry` SSE events are published. The job now appears in the DLQ
3. If the processor catches an unexpected exception rather than receiving a handler failure result, the same retry/DLQ logic applies using the exception message as the error

### 4.6 DAG Execution

1. Job C is created with `depends_on: <id of A>` (and optionally a separate row for B). Rows are inserted into `job_dependencies`
2. The `fetchDueJobs()` query contains a `NOT EXISTS` subquery: it excludes any job that has a dependency row where the referenced job's status is not `completed`. C is invisible to the heap until both A and B reach `completed`
3. As each dependency completes, the next poll tick's `fetchDueJobs()` re-checks. Once all dependencies are `completed`, C passes the filter and enters the heap normally
4. Additionally, `processJob` runs `checkDependenciesMet(jobId)` immediately before execution as a second gate, in case a dependency was cancelled or failed between the DB fetch and execution. If unmet at that point, the job is released back to `pending`

### 4.7 Job Cancellation

1. Client sends `POST /api/v1/jobs/:id/cancel`
2. The API looks up the job. If it does not exist, returns 404
3. `cancelJob(id)` runs:
   ```sql
   UPDATE jobs
   SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
   WHERE id = $1 AND status IN ('pending', 'processing')
   RETURNING *
   ```
   - If the job is `pending`: the update succeeds, status becomes `cancelled`. The worker's next claim attempt will fail the `FOR UPDATE SKIP LOCKED` check (row no longer `pending`) and skip it
   - If the job is `processing`: the update succeeds, status becomes `cancelled`. The processor will detect this on its post-claim re-fetch (`fetchedJob.status === 'cancelled'`) and call `cancelJob()` again to write the final state cleanly, then return without executing the handler
   - If the job is `completed`, `failed`, or already `cancelled`: the `WHERE` clause does not match. The function returns `null`, and the API responds with 409
4. A `job.cancelled` SSE event and a `stats.updated` event are published to Redis

---

## 5.0 Design Decisions

**PostgreSQL as the queue.** Rather than using a dedicated message broker (RabbitMQ, SQS), all job state lives in PostgreSQL. This gives full ACID guarantees, allows complex queries (filtering, DLQ view, dependency checks) without a separate data store, and eliminates the operational overhead of a second stateful service. The trade-off is that throughput is bounded by PostgreSQL's write concurrency — acceptable for this use case.

**`FOR UPDATE SKIP LOCKED` for duplicate protection.** This is the standard PostgreSQL pattern for job queues. It is atomic, requires no application-level locks, and scales naturally across multiple worker processes. A job that is already locked by one worker is invisible to all others — they move on to the next row rather than blocking.

**In-memory heap over repeated DB polling.** Without the heap, each tick would require a full `SELECT ... ORDER BY ... LIMIT 1 FOR UPDATE SKIP LOCKED` query. The heap shifts the ordering work in-memory and batches DB fetches. The heap feeder loop runs every 30 seconds to pick up newly created jobs. The trade-off: the heap is not persisted — a worker restart re-fetches from the DB, which is correct and safe.

**Aging in the score function.** Strict priority ordering causes starvation: low-priority jobs can wait indefinitely if high-priority jobs keep arriving. Aging addresses this by continuously reducing a waiting job's effective score. The parameters (10-minute threshold, 0.5 step per threshold) mean a priority-3 job that has waited 40 minutes is treated the same as a fresh priority-1 job. These values are constants in `scheduler.ts` and can be tuned.

**Worker isolation via separate process.** The worker is started with `node dist/worker/index.js`, separate from the API server. This means a handler that crashes the Node.js process does not take down the HTTP API. It also allows the two processes to be scaled and deployed independently.

**Re-fetch after claim.** The processor re-fetches the job row immediately after claiming it. This catches cancellations that arrived between the heap pop and the DB claim. Without this, a cancelled job could still execute.

**Dependency enforcement at two layers.** Dependencies are checked in `fetchDueJobs()` (SQL `NOT EXISTS` subquery) to keep ineligible jobs out of the heap entirely, and again in `processJob()` immediately before execution. The double-check catches the edge case where a dependency is cancelled or failed after the job entered the heap but before it was executed.

**SSE over WebSockets for live updates.** SSE is unidirectional (server to client), which is all this use case requires — the client does not need to send data back over the same connection. SSE is simpler to implement, works over HTTP/1.1, reconnects automatically in the browser, and does not require a WebSocket upgrade.

**Single Redis channel with typed events.** All events are published to one channel (`scheduler:events`) and carry a discriminated `type` field. The SSE endpoint uses named event frames (`event: job.completed\ndata: {...}`) so the browser's `EventSource` API can dispatch to named listeners. Adding a new event type requires one new type in `src/events/types.ts` and a `publish()` call — no routing configuration needed.

---

## 6.0 Alternative Scheduling Algorithm: Skip List

### 6.1 Description

A **min-heap** is a complete binary tree stored as a flat array. Every parent node has a score ≤ its children's scores, so the most urgent job always sits at index 0. Two array operations maintain the invariant: `siftUp` after insert (walk new element up until its parent is smaller) and `siftDown` after pop (move the displaced last element down until both children are larger). Because all nodes live in a single contiguous array, traversal is cache-friendly.

A **skip list** is a sorted linked list with multiple stacked express lanes. Level 0 holds every node in sorted order. Each higher level is a sparser subset, chosen at insert time by repeated coin-flips (p = 0.5, up to `MAX_LEVEL = 16`). Walking down levels to find the insertion point gives O(log n) expected time. The minimum element is always `head.forward[0]` — a single pointer dereference, O(1).

Both structures use the same score function (`priority` minus an aging bonus) so ordering decisions are equivalent — the only variable being benchmarked is structural cost. The implementation lives in `src/worker/skip-list-scheduler.ts` and satisfies the same `JobScheduler` interface as `MinHeap`, making them drop-in replacements for each other.

### 6.2 Comparison with Min-Heap

| Operation           | Min-Heap              | Skip List                          |
| ------------------- | --------------------- | ---------------------------------- |
| Insert              | O(log n) — array sift | O(log n) expected — pointer walk   |
| Pop (get next)      | O(log n) — siftDown   | O(log n) expected — re-link levels |
| Peek                | O(1)                  | O(1) — always `head.forward[0]`    |
| Duplicate detection | O(1) via Set          | O(1) via Set                       |
| Memory overhead     | O(n) flat array       | O(n · MAX_LEVEL) pointer nodes     |
| In-order traversal  | Requires full drain   | Free — walk level 0                |
| Implementation      | Deterministic         | Probabilistic (randomised levels)  |

**Benchmark — median of 15 runs, Node.js v24, identical job set for both schedulers**

Jobs have randomised priorities (1–3) and `created_at` values spread over ±2 hours so the aging bonus produces varied scores.

| N      | Operation | MinHeap  | SkipList | Winner   |
| ------ | --------- | -------- | -------- | -------- |
| 1,000  | insert    | 1.07 ms  | 2.98 ms  | MinHeap  |
| 1,000  | drain     | 3.49 ms  | 0.31 ms  | SkipList |
| 5,000  | insert    | 5.69 ms  | 20.84 ms | MinHeap  |
| 5,000  | drain     | 30.24 ms | 0.31 ms  | SkipList |
| 10,000 | insert    | 13.67 ms | 48.85 ms | MinHeap  |
| 10,000 | drain     | 74.13 ms | 1.03 ms  | SkipList |

MinHeap wins on insert (~2–4× faster) because sifting up a contiguous array is cache-friendly and allocation-free. SkipList wins dramatically on drain (~30–70× faster) because pop is pure pointer relinking at the head — no siftDown traversal. The heap's drain time also inflates because its score function re-evaluates `Date.now()` at each comparison, meaning scores shift mid-drain.

**Which one the worker uses:** `MinHeap`. The worker pops one job per tick and never fully drains the structure in a single pass, so the drain gap is irrelevant. Insert performance is what matters for the 30-second heap feeder loop, and MinHeap wins there.

To reproduce: `pnpm tsx src/scripts/benchmark-schedulers.ts`

---

## 7.0 Tradeoffs and Limitations

**Single worker bottleneck.** The current architecture runs one job at a time per worker process (the poll loop awaits the in-flight job before moving to the next). Horizontal scaling requires running multiple worker processes, each competing for DB locks. The `FOR UPDATE SKIP LOCKED` design supports this correctly, but it has not been load-tested at scale.

**Heap is not persisted.** If the worker process crashes, all jobs in the heap are lost from memory. They are not lost from the database — the next worker start will re-fetch them via `fetchDueJobs()`. The window of invisibility is at most one heap feeder interval (30 seconds) plus the time for a zombie reaper cycle.

**No cycle detection in DAG.** The `job_dependencies` schema enforces no self-loops (`CHECK (job_id <> depends_on_id)`) but does not detect multi-hop cycles (A depends on B, B depends on A). Application code must prevent this at insertion time. A cyclic dependency will cause both jobs to wait indefinitely.

**DLQ threshold alert is defined but not yet sent.** The threshold check logic and email dispatch are on the implementation roadmap.

**Recurring intervals are static.** The three supported intervals (`every_1_minute`, `every_5_minutes`, `every_1_hour`) are hardcoded in `src/utils.ts`. Arbitrary cron-style intervals are not supported.

**Handler registry is static.** Handlers are registered at startup in a plain object. Adding a new job type requires a code change and a worker restart. Dynamic handler registration is not supported.

**Redis is a new dependency.** Adding Redis as a required infrastructure component introduces an additional failure mode. If Redis is unavailable, `publish()` calls fail silently (the error is logged as a warning, job processing is not interrupted), but the SSE stream will not receive events until Redis reconnects.
