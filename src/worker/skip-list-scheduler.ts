import type { Job } from "../types";
import type { JobScheduler } from "./scheduler-interface";
import { MinHeap } from "./scheduler";

/**
 * SkipListScheduler — a probabilistic sorted structure for job scheduling.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * What is a skip list?
 * ──────────────────────────────────────────────────────────────────────────
 * A skip list is a layered linked list where each node participates in
 * multiple "express lanes" with decreasing probability. Level 0 is a
 * standard sorted linked list containing every node. Each higher level is a
 * sparse subset of the level below, chosen at insert time by repeated
 * coin-flips (probability p = 0.5 per level).
 *
 * The structure looks like:
 *
 *   level 3:  head ──────────────────────────────────────────► tail
 *   level 2:  head ────────────────► [node B] ─────────────► tail
 *   level 1:  head ──► [node A] ──► [node B] ──► [node D] ──► tail
 *   level 0:  head ──► [node A] ──► [node B] ──► [node C] ──► [node D] ──► tail
 *
 * To find the minimum element (head.forward[0].job), cost is O(1).
 * To insert a new node at the correct sorted position, we walk down from
 * the top level, skipping over nodes that sort before the new one, then
 * drop to the level below. This gives O(log n) expected time.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Ordering
 * ──────────────────────────────────────────────────────────────────────────
 * The skip list is sorted in ascending order of effective score so the head
 * of the list is always the most urgent job (same score as MinHeap uses).
 * The score function is identical to MinHeap.scoreJob() — lower = more urgent.
 *
 * Using the same score means both schedulers make identical ordering decisions
 * on the same input, which makes the benchmark comparison valid: it measures
 * structural cost, not a difference in ordering logic.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Complexity summary
 * ──────────────────────────────────────────────────────────────────────────
 *   insert(jobs) — O(k log n) expected, O(k n) worst case (degenerate levels)
 *   pop()        — O(log n) expected (need to re-link all levels)
 *   peek()       — O(1) (head.forward[0] is always the minimum)
 *   size()       — O(1)
 *   has()        — O(1) via inList Set
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Trade-offs vs MinHeap
 * ──────────────────────────────────────────────────────────────────────────
 *   peek():    skip list wins — O(1) vs O(1) heap (same), but skip list
 *              traversal is a single pointer dereference; heap also O(1)
 *   pop():     similar in practice; heap's siftDown on a contiguous array
 *              has better cache locality than skip list pointer-chasing
 *   insert():  both O(log n); heap is typically faster in practice due to
 *              array locality and fewer allocations
 *   memory:    skip list allocates a node object per job with MAX_LEVEL
 *              forward pointers; heap uses a flat array — heap wins here
 *   sorted traversal: skip list supports O(n) in-order traversal for free;
 *              heap does not — you must pop everything to get sorted order
 *   implementation complexity: skip list is more code with probabilistic
 *              behaviour; heap is simpler and fully deterministic
 */

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

class SkipNode {
  job: Job | null; // null only for the sentinel head and tail nodes
  forward: SkipNode[];

  constructor(job: Job | null, level: number) {
    this.job = job;
    this.forward = new Array<SkipNode>(level + 1);
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of levels in the skip list.
 *
 * For n elements, the expected height of the tallest node is log_{1/p}(n).
 * With p = 0.5 and MAX_LEVEL = 16, the list handles up to 2^16 ≈ 65,536
 * elements at ideal height. Beyond that the list still works correctly —
 * just without the full log(n) benefit from higher levels.
 *
 * 16 is a practical sweet spot: enough levels for tens of thousands of jobs
 * without wasting memory on mostly-empty level arrays.
 */
const MAX_LEVEL = 16;

/** Probability of promoting a node to the next level. */
const LEVEL_PROBABILITY = 0.5;

// ---------------------------------------------------------------------------
// Skip List Scheduler
// ---------------------------------------------------------------------------

export class SkipListScheduler implements JobScheduler {
  private head: SkipNode;
  private tail: SkipNode;
  private currentLevel: number;
  private count: number;
  private inList: Set<string>;

  constructor() {
    // Sentinel tail — score +Infinity so every real job sorts before it
    this.tail = new SkipNode(null, MAX_LEVEL);

    // Sentinel head — score -Infinity, all forward pointers start at tail
    this.head = new SkipNode(null, MAX_LEVEL);
    for (let i = 0; i <= MAX_LEVEL; i++) {
      this.head.forward[i] = this.tail;
    }

    this.currentLevel = 0;
    this.count = 0;
    this.inList = new Set();
  }

  // ── Scoring (identical to MinHeap.scoreJob so results are comparable) ──

  private static score(job: Job): number {
    return MinHeap.scoreJob(job);
  }

  // ── Level generation ───────────────────────────────────────────────────

  /**
   * Determines the height of a newly inserted node by flipping coins.
   * Each level is added with probability LEVEL_PROBABILITY up to MAX_LEVEL.
   * Returns a value in the range [0, MAX_LEVEL].
   *
   * This is the "randomized" step that gives skip lists their O(log n)
   * expected performance. Without randomisation the list degenerates.
   */
  private randomLevel(): number {
    let level = 0;
    while (Math.random() < LEVEL_PROBABILITY && level < MAX_LEVEL) {
      level++;
    }
    return level;
  }

  // ── Core operations ────────────────────────────────────────────────────

  /**
   * Insert a batch of jobs into the skip list.
   *
   * For each job:
   * 1. Skip if already present (duplicate protection via inList Set).
   * 2. Walk from the top level downward, recording the rightmost node at
   *    each level that sorts strictly before the new node (update array).
   * 3. Roll a random level for the new node.
   * 4. Splice the new node in after update[i] at every level up to its height.
   *
   * The update array is a standard skip list technique: it records the
   * predecessor at each level so we can relink forward pointers in O(1)
   * per level after finding the insertion position.
   */
  insert(jobs: Job[]): void {
    for (const job of jobs) {
      if (this.inList.has(job.id)) continue;

      const newScore = SkipListScheduler.score(job);
      const update: SkipNode[] = new Array(MAX_LEVEL + 1);
      let current = this.head;

      // Walk from top level downward, finding the insertion position
      for (let i = this.currentLevel; i >= 0; i--) {
        while (
          current.forward[i] !== this.tail &&
          current.forward[i].job !== null &&
          SkipListScheduler.score(current.forward[i].job!) < newScore
        ) {
          current = current.forward[i];
        }
        update[i] = current;
      }

      // Determine the level for the new node
      const nodeLevel = this.randomLevel();

      // If the new node reaches higher levels than any existing node,
      // wire those levels' predecessors to head.
      if (nodeLevel > this.currentLevel) {
        for (let i = this.currentLevel + 1; i <= nodeLevel; i++) {
          update[i] = this.head;
        }
        this.currentLevel = nodeLevel;
      }

      // Create and splice in the new node
      const newNode = new SkipNode(job, nodeLevel);
      for (let i = 0; i <= nodeLevel; i++) {
        newNode.forward[i] = update[i].forward[i];
        update[i].forward[i] = newNode;
      }

      this.inList.add(job.id);
      this.count++;
    }
  }

  /**
   * Remove and return the job with the lowest score (highest urgency).
   *
   * The minimum is always head.forward[0] (first real node at level 0).
   * We must unlink it from every level it participates in.
   *
   * Walk from currentLevel down to 0: if head.forward[i] is the minimum
   * node, update head.forward[i] to skip over it. Then trim currentLevel
   * if the top levels are now empty.
   *
   * O(log n) expected — we only visit the levels the minimum node occupies.
   */
  pop(): Job | undefined {
    const first = this.head.forward[0];
    if (first === this.tail || first.job === null) return undefined;

    const job = first.job;

    // Unlink from all levels
    for (let i = this.currentLevel; i >= 0; i--) {
      if (this.head.forward[i] !== first) break;
      this.head.forward[i] = first.forward[i];
    }

    // Trim empty top levels
    while (
      this.currentLevel > 0 &&
      this.head.forward[this.currentLevel] === this.tail
    ) {
      this.currentLevel--;
    }

    this.inList.delete(job.id);
    this.count--;
    return job;
  }

  /**
   * Return the highest-urgency job without removing it.
   * The minimum is always at head.forward[0].
   * O(1).
   */
  peek(): Job | undefined {
    const first = this.head.forward[0];
    return first !== this.tail && first.job !== null ? first.job : undefined;
  }

  size(): number {
    return this.count;
  }

  has(jobId: string): boolean {
    return this.inList.has(jobId);
  }

  clear(): void {
    for (let i = 0; i <= MAX_LEVEL; i++) {
      this.head.forward[i] = this.tail;
    }
    this.currentLevel = 0;
    this.count = 0;
    this.inList.clear();
  }
}
