import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Job, JobStatus } from "../src/types";
import { MinHeap } from "../src/worker/scheduler";

// ── Helpers ───────────────────────────────────────────────────────────────────

let idCounter = 0;

/**
 * Build a Job fixture. created_at defaults to now so the job has zero
 * waiting time (no aging bonus). Override created_at to simulate age.
 */
function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${++idCounter}`,
    type: "send_email",
    payload: {},
    status: JobStatus.PENDING,
    priority: 2,
    attempt_count: 0,
    max_retries: 3,
    next_retry_at: null,
    scheduled_at: new Date(),
    recur_interval: null,
    last_error: null,
    result: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/** Returns a Date that is `minutes` minutes in the past. */
function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

/** Drain the entire heap and return IDs in pop order. */
function drainIds(heap: MinHeap): string[] {
  const ids: string[] = [];
  let job: Job | undefined;
  while ((job = heap.pop()) !== undefined) {
    ids.push(job.id);
  }
  return ids;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MinHeap — basic operations", () => {
  let heap: MinHeap;

  beforeEach(() => {
    heap = new MinHeap();
  });

  it("starts empty", () => {
    expect(heap.size()).toBe(0);
    expect(heap.peek()).toBeUndefined();
    expect(heap.pop()).toBeUndefined();
  });

  it("size() reflects the number of inserted jobs", () => {
    heap.insert([makeJob(), makeJob(), makeJob()]);
    expect(heap.size()).toBe(3);
  });

  it("peek() returns the top job without removing it", () => {
    const job = makeJob({ priority: 1 });
    heap.insert([job]);
    expect(heap.peek()).toBe(job);
    expect(heap.size()).toBe(1); // not removed
  });

  it("pop() removes and returns the top job", () => {
    const job = makeJob({ priority: 1 });
    heap.insert([job]);
    expect(heap.pop()).toBe(job);
    expect(heap.size()).toBe(0);
  });

  it("pop() on empty heap returns undefined", () => {
    expect(heap.pop()).toBeUndefined();
  });

  it("has() returns true for inserted job, false otherwise", () => {
    const job = makeJob({ id: "known" });
    heap.insert([job]);
    expect(heap.has("known")).toBe(true);
    expect(heap.has("unknown")).toBe(false);
  });

  it("has() returns false after the job is popped", () => {
    const job = makeJob({ id: "to-pop" });
    heap.insert([job]);
    heap.pop();
    expect(heap.has("to-pop")).toBe(false);
  });

  it("clear() empties the heap and resets id tracking", () => {
    const job = makeJob({ id: "clearable" });
    heap.insert([job]);
    heap.clear();
    expect(heap.size()).toBe(0);
    expect(heap.has("clearable")).toBe(false);
    // After clear, the same job can be re-inserted
    heap.insert([job]);
    expect(heap.size()).toBe(1);
  });
});

// ── Priority ordering ─────────────────────────────────────────────────────────

describe("MinHeap — priority ordering (no aging)", () => {
  let heap: MinHeap;

  beforeEach(() => {
    heap = new MinHeap();
  });

  it("inserts high-priority job last but pops it first", () => {
    const low    = makeJob({ id: "low",    priority: 3 });
    const medium = makeJob({ id: "medium", priority: 2 });
    const high   = makeJob({ id: "high",   priority: 1 });

    heap.insert([low, medium, high]);

    expect(heap.pop()!.id).toBe("high");
    expect(heap.pop()!.id).toBe("medium");
    expect(heap.pop()!.id).toBe("low");
  });

  it("pops in priority order regardless of insertion order", () => {
    // Insert worst-first
    heap.insert([
      makeJob({ id: "p3", priority: 3 }),
      makeJob({ id: "p1", priority: 1 }),
      makeJob({ id: "p2", priority: 2 }),
    ]);

    expect(drainIds(heap)).toEqual(["p1", "p2", "p3"]);
  });

  it("handles all same-priority jobs without crashing", () => {
    const jobs = [
      makeJob({ id: "a", priority: 2 }),
      makeJob({ id: "b", priority: 2 }),
      makeJob({ id: "c", priority: 2 }),
    ];
    heap.insert(jobs);
    expect(heap.size()).toBe(3);
    // All three should come out (order is unspecified when scores tie)
    const ids = drainIds(heap);
    expect(ids).toHaveLength(3);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
  });

  it("single job inserted and popped returns that job", () => {
    const job = makeJob({ id: "only", priority: 1 });
    heap.insert([job]);
    expect(heap.pop()).toBe(job);
    expect(heap.size()).toBe(0);
  });

  it("interleaved inserts and pops maintain heap order", () => {
    heap.insert([makeJob({ id: "p3", priority: 3 })]);
    heap.insert([makeJob({ id: "p1", priority: 1 })]);
    expect(heap.pop()!.id).toBe("p1"); // p1 wins

    heap.insert([makeJob({ id: "p2", priority: 2 })]);
    // Remaining: p3, p2 — p2 wins
    expect(heap.pop()!.id).toBe("p2");
    expect(heap.pop()!.id).toBe("p3");
    expect(heap.pop()).toBeUndefined();
  });
});

// ── scoreJob ──────────────────────────────────────────────────────────────────

describe("MinHeap.scoreJob — aging formula", () => {
  it("returns raw priority for a brand-new job (0 minutes old)", () => {
    // Jobs created right now have < 1 minute waiting → floor(0) * 0.5 = 0
    const job = makeJob({ priority: 3, created_at: new Date() });
    expect(MinHeap.scoreJob(job)).toBe(3);
  });

  it("priority 1 job has score 1.0 when brand-new", () => {
    expect(MinHeap.scoreJob(makeJob({ priority: 1, created_at: new Date() }))).toBe(1);
  });

  it("priority 2 job has score 2.0 when brand-new", () => {
    expect(MinHeap.scoreJob(makeJob({ priority: 2, created_at: new Date() }))).toBe(2);
  });

  it("applies first aging step at exactly 10 minutes", () => {
    // floor(10 / 10) * 0.5 = 0.5; score = 3 - 0.5 = 2.5
    const job = makeJob({ priority: 3, created_at: minutesAgo(10) });
    expect(MinHeap.scoreJob(job)).toBeCloseTo(2.5, 5);
  });

  it("applies second aging step at exactly 20 minutes", () => {
    // floor(20 / 10) * 0.5 = 1.0; score = 3 - 1.0 = 2.0
    const job = makeJob({ priority: 3, created_at: minutesAgo(20) });
    expect(MinHeap.scoreJob(job)).toBeCloseTo(2.0, 5);
  });

  it("no step at 9 minutes (just before first threshold)", () => {
    // floor(9 / 10) * 0.5 = 0; score = 3
    const job = makeJob({ priority: 3, created_at: minutesAgo(9) });
    expect(MinHeap.scoreJob(job)).toBeCloseTo(3.0, 5);
  });

  it("score at 40 minutes: priority-3 job reaches urgency of priority-1 (score 1.0)", () => {
    // floor(40 / 10) * 0.5 = 2.0; score = 3 - 2.0 = 1.0
    const job = makeJob({ priority: 3, created_at: minutesAgo(40) });
    expect(MinHeap.scoreJob(job)).toBeCloseTo(1.0, 5);
  });

  it("score is clamped to 0 — never goes negative", () => {
    // A priority-1 job that is 100 minutes old:
    // floor(100 / 10) * 0.5 = 5.0; raw = 1 - 5 = -4 → clamped to 0
    const job = makeJob({ priority: 1, created_at: minutesAgo(100) });
    expect(MinHeap.scoreJob(job)).toBe(0);
  });

  it("score is clamped to 0 for priority-3 job aged 200 minutes", () => {
    const job = makeJob({ priority: 3, created_at: minutesAgo(200) });
    expect(MinHeap.scoreJob(job)).toBe(0);
  });
});

// ── Aging-driven reordering ───────────────────────────────────────────────────

describe("MinHeap — aging causes low-priority jobs to overtake high-priority ones", () => {
  /**
   * Core starvation-prevention property:
   * A low-priority job that has been waiting long enough must eventually
   * reach a score equal to or lower than a freshly-inserted high-priority job.
   *
   * Scores are evaluated at comparison time, so inserting a new job into a
   * heap that already contains an aged job will place the aged job correctly.
   */

  it("a 40-min-old priority-3 job scores the same as a fresh priority-1 job", () => {
    const agedLow   = makeJob({ priority: 3, created_at: minutesAgo(40) });
    const freshHigh = makeJob({ priority: 1, created_at: new Date() });

    // Both should score ≈ 1.0
    expect(MinHeap.scoreJob(agedLow)).toBeCloseTo(1.0, 5);
    expect(MinHeap.scoreJob(freshHigh)).toBeCloseTo(1.0, 5);
  });

  it("a 50-min-old priority-3 job scores lower than a fresh priority-1 job (comes out first)", () => {
    // floor(50 / 10) * 0.5 = 2.5; score = 3 - 2.5 = 0.5
    const veryAgedLow = makeJob({ id: "aged-p3", priority: 3, created_at: minutesAgo(50) });
    // fresh p1 score = 1.0
    const freshHigh   = makeJob({ id: "fresh-p1", priority: 1, created_at: new Date() });

    expect(MinHeap.scoreJob(veryAgedLow)).toBeLessThan(MinHeap.scoreJob(freshHigh));

    const heap = new MinHeap();
    heap.insert([freshHigh, veryAgedLow]);
    // aged p3 (score 0.5) must pop before fresh p1 (score 1.0)
    expect(heap.pop()!.id).toBe("aged-p3");
  });

  it("fresh priority-1 job is NOT overtaken by a brand-new priority-3 job", () => {
    const freshHigh = makeJob({ id: "p1", priority: 1, created_at: new Date() });
    const freshLow  = makeJob({ id: "p3", priority: 3, created_at: new Date() });

    const heap = new MinHeap();
    heap.insert([freshLow, freshHigh]);
    expect(heap.pop()!.id).toBe("p1");
  });

  it("aging accumulates in discrete steps (floor, not linear interpolation)", () => {
    // 15 minutes in: floor(15/10) = 1 step; score = 3 - 0.5 = 2.5
    const at15 = makeJob({ priority: 3, created_at: minutesAgo(15) });
    // 19 minutes in: floor(19/10) = 1 step; same score = 2.5
    const at19 = makeJob({ priority: 3, created_at: minutesAgo(19) });
    // 20 minutes in: floor(20/10) = 2 steps; score = 3 - 1.0 = 2.0
    const at20 = makeJob({ priority: 3, created_at: minutesAgo(20) });

    expect(MinHeap.scoreJob(at15)).toBeCloseTo(MinHeap.scoreJob(at19), 5);
    expect(MinHeap.scoreJob(at20)).toBeLessThan(MinHeap.scoreJob(at19));
  });
});

// ── Duplicate protection ──────────────────────────────────────────────────────

describe("MinHeap — duplicate protection via inHeap set", () => {
  let heap: MinHeap;

  beforeEach(() => {
    heap = new MinHeap();
  });

  it("inserting the same job twice only adds it once", () => {
    const job = makeJob({ id: "dup" });
    heap.insert([job, job]);
    expect(heap.size()).toBe(1);
  });

  it("batch insert with duplicate IDs only adds each job once", () => {
    const job = makeJob({ id: "dup" });
    heap.insert([job]);
    heap.insert([job]); // second batch — should be a no-op for this id
    expect(heap.size()).toBe(1);
  });

  it("has() returns true while job is in heap, false once popped", () => {
    const job = makeJob({ id: "tracked" });
    heap.insert([job]);
    expect(heap.has("tracked")).toBe(true);
    heap.pop();
    expect(heap.has("tracked")).toBe(false);
  });

  it("re-inserting a popped job works correctly — it re-enters the heap", () => {
    const job = makeJob({ id: "reinsert" });
    heap.insert([job]);
    heap.pop();                // remove it
    heap.insert([job]);        // insert again
    expect(heap.size()).toBe(1);
    expect(heap.has("reinsert")).toBe(true);
  });

  it("large batch with duplicates: heap size equals unique job count", () => {
    const job1 = makeJob({ id: "x1" });
    const job2 = makeJob({ id: "x2" });
    const job3 = makeJob({ id: "x3" });

    // 6 entries but only 3 unique IDs
    heap.insert([job1, job2, job3, job1, job2, job3]);
    expect(heap.size()).toBe(3);
  });
});

// ── Heap correctness under large batches ──────────────────────────────────────

describe("MinHeap — ordering correctness under varied loads", () => {
  it("correctly orders 10 jobs with mixed priorities", () => {
    const heap = new MinHeap();
    const jobs = [
      makeJob({ id: "a", priority: 3 }),
      makeJob({ id: "b", priority: 1 }),
      makeJob({ id: "c", priority: 2 }),
      makeJob({ id: "d", priority: 1 }),
      makeJob({ id: "e", priority: 3 }),
      makeJob({ id: "f", priority: 2 }),
      makeJob({ id: "g", priority: 1 }),
      makeJob({ id: "h", priority: 2 }),
      makeJob({ id: "i", priority: 3 }),
      makeJob({ id: "j", priority: 1 }),
    ];
    heap.insert(jobs);

    const popped: Job[] = [];
    let job: Job | undefined;
    while ((job = heap.pop()) !== undefined) popped.push(job);

    // Scores must be non-decreasing (min-heap property)
    for (let i = 1; i < popped.length; i++) {
      expect(MinHeap.scoreJob(popped[i])).toBeGreaterThanOrEqual(
        MinHeap.scoreJob(popped[i - 1]),
      );
    }

    // All priority-1 jobs must come before any priority-3 job
    const p1Indices = popped.map((j, idx) => j.priority === 1 ? idx : -1).filter(i => i >= 0);
    const p3Indices = popped.map((j, idx) => j.priority === 3 ? idx : -1).filter(i => i >= 0);
    expect(Math.max(...p1Indices)).toBeLessThan(Math.min(...p3Indices));
  });

  it("heap property holds after every single pop (scores non-decreasing)", () => {
    const heap = new MinHeap();
    for (let i = 0; i < 20; i++) {
      heap.insert([makeJob({ priority: ([1, 2, 3] as const)[i % 3] })]);
    }

    let prevScore = -Infinity;
    let job: Job | undefined;
    while ((job = heap.pop()) !== undefined) {
      const score = MinHeap.scoreJob(job);
      expect(score).toBeGreaterThanOrEqual(prevScore);
      prevScore = score;
    }
  });
});

// ── clear() ───────────────────────────────────────────────────────────────────

describe("MinHeap — clear()", () => {
  it("clear() on an empty heap is safe", () => {
    const heap = new MinHeap();
    expect(() => heap.clear()).not.toThrow();
    expect(heap.size()).toBe(0);
  });

  it("clear() resets size to 0", () => {
    const heap = new MinHeap();
    heap.insert([makeJob(), makeJob(), makeJob()]);
    heap.clear();
    expect(heap.size()).toBe(0);
  });

  it("clear() allows fresh jobs with previously-seen IDs to be inserted", () => {
    const heap = new MinHeap();
    const job = makeJob({ id: "post-clear" });
    heap.insert([job]);
    heap.clear();
    heap.insert([job]); // same ID — must succeed after clear
    expect(heap.size()).toBe(1);
    expect(heap.has("post-clear")).toBe(true);
  });

  it("pop() after clear() returns undefined", () => {
    const heap = new MinHeap();
    heap.insert([makeJob()]);
    heap.clear();
    expect(heap.pop()).toBeUndefined();
  });
});
