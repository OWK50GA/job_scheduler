import { Job } from "../types";
import type { JobScheduler } from "./scheduler-interface";

/**
 * Aging configuration for starvation prevention.
 *
 * A job that has been waiting in the pending state gains effective priority
 * over time. Every AGING_THRESHOLD_MINUTES that pass, the job's effective
 * score drops by AGING_STEP, making it more urgent.
 *
 * Example with defaults (10 min threshold, 0.5 step):
 *   priority-3 job,  0 min old → score 3.0
 *   priority-3 job, 10 min old → score 2.5
 *   priority-3 job, 20 min old → score 2.0
 *   priority-3 job, 40 min old → score 1.0  (same urgency as priority-1)
 *
 * Score is always clamped to a minimum of 0 so it never goes negative.
 */
const AGING_THRESHOLD_MINUTES = 10;
const AGING_STEP = 0.5;

/**
 * MinHeap<Job> — a binary min-heap ordered by effective job score.
 *
 * Lower score = higher urgency = comes out first.
 *
 * Data structures:
 *   heap: Job[]       — the heap array; index math gives parent/child positions
 *   inHeap: Set<string> — set of job IDs currently in the heap, for O(1)
 *                         duplicate detection during batch inserts
 *
 * Scores are computed at comparison time (during sift operations), not at
 * insert time. This ensures that aging continues to apply correctly: a job
 * inserted 30 minutes ago has a better score now than it did when inserted.
 */
export class MinHeap implements JobScheduler {
  private heap: Job[] = [];
  private inHeap: Set<string> = new Set();

  // ── Scoring ────────────────────────────────────────────────────────────────

  /**
   * Computes the effective priority score for a job.
   *
   * score = priority - agingBonus
   * agingBonus = floor(minutesWaiting / AGING_THRESHOLD_MINUTES) * AGING_STEP
   *
   * Lower score = more urgent.
   * Score is clamped to >= 0.
   */
  static scoreJob(job: Job): number {
    const minutesWaiting = (Date.now() - job.created_at.getTime()) / 60_000;
    const agingBonus =
      Math.floor(minutesWaiting / AGING_THRESHOLD_MINUTES) * AGING_STEP;
    return Math.max(0, job.priority - agingBonus);
  }

  private parent(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private left(i: number): number {
    return 2 * i + 1;
  }

  private right(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  // ── Sift operations ────────────────────────────────────────────────────────

  /**
   * Sift the element at index i upward until the heap invariant holds.
   * Called after inserting a new element at the end.
   */
  private siftUp(i: number): void {
    while (i > 0) {
      const p = this.parent(i);
      if (MinHeap.scoreJob(this.heap[p]) > MinHeap.scoreJob(this.heap[i])) {
        this.swap(i, p);
        i = p;
      } else {
        break;
      }
    }
  }

  /**
   * Sift the element at index i downward until the heap invariant holds.
   * Called after removing the root and moving the last element to the top.
   */
  private siftDown(i: number): void {
    const n = this.heap.length;

    while (true) {
      let smallest = i;
      const l = this.left(i);
      const r = this.right(i);

      if (
        l < n &&
        MinHeap.scoreJob(this.heap[l]) < MinHeap.scoreJob(this.heap[smallest])
      ) {
        smallest = l;
      }

      if (
        r < n &&
        MinHeap.scoreJob(this.heap[r]) < MinHeap.scoreJob(this.heap[smallest])
      ) {
        smallest = r;
      }

      if (smallest !== i) {
        this.swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  /**
   * Inserts a batch of jobs into the heap.
   *
   * Jobs whose IDs are already in the heap are silently skipped — this is
   * the duplicate protection mechanism for periodic DB reloads. Without it,
   * the same job would appear multiple times and potentially be claimed twice.
   *
   * Each insertion is O(log n), so inserting a batch of k jobs is O(k log n).
   */
  insert(jobs: Job[]): void {
    for (const job of jobs) {
      if (this.inHeap.has(job.id)) continue;

      this.heap.push(job);
      this.inHeap.add(job.id);
      this.siftUp(this.heap.length - 1);
    }
  }

  /**
   * Removes and returns the job with the lowest effective score (highest
   * urgency). Returns undefined if the heap is empty.
   *
   * O(log n).
   */
  pop(): Job | undefined {
    if (this.heap.length === 0) return undefined;

    const top = this.heap[0];
    const last = this.heap.pop()!;
    this.inHeap.delete(top.id);

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }

    return top;
  }

  /**
   * Returns the job with the lowest effective score without removing it.
   * Returns undefined if the heap is empty.
   *
   * O(1).
   */
  peek(): Job | undefined {
    return this.heap[0];
  }

  /**
   * Returns the number of jobs currently in the heap.
   *
   * O(1).
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * Returns true if the given job ID is already in the heap.
   * Used externally to check before re-inserting a job.
   *
   * O(1).
   */
  has(jobId: string): boolean {
    return this.inHeap.has(jobId);
  }

  /**
   * Removes all jobs from the heap and clears the ID tracking set.
   * Used when performing a full reload from the DB.
   */
  clear(): void {
    this.heap = [];
    this.inHeap.clear();
  }
}
