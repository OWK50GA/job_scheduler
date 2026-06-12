import type { Job } from "../types";

/**
 * Common interface shared by every scheduling algorithm implementation.
 *
 * Both MinHeap (scheduler.ts) and SkipListScheduler (skip-list-scheduler.ts)
 * satisfy this contract, making them drop-in replacements for each other.
 * The worker and the benchmark script program against this interface, not
 * against a concrete class.
 */
export interface JobScheduler {
  /**
   * Insert a batch of jobs.
   * Duplicate IDs must be silently ignored — this is called periodically
   * from the heap feeder loop with all currently due jobs.
   * O(k log n) where k = jobs.length.
   */
  insert(jobs: Job[]): void;

  /**
   * Remove and return the job with the highest urgency (lowest effective score).
   * Returns undefined when empty.
   */
  pop(): Job | undefined;

  /**
   * Return the highest-urgency job without removing it.
   * Returns undefined when empty.
   */
  peek(): Job | undefined;

  /** Number of jobs currently held by the scheduler. */
  size(): number;

  /** True if the given job ID is already present. O(1). */
  has(jobId: string): boolean;

  /** Remove all jobs. */
  clear(): void;
}
