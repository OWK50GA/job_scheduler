import { JobStatus } from "./types";

export const isValidJobStatus = (t: unknown): t is JobStatus => {
  return (
    typeof t === "string" &&
    Object.values(JobStatus)
      .map((s) => s.toLowerCase())
      .includes(t.toLowerCase())
  );
};

export const isValidJobPriority = (p: unknown): boolean => {
  return (
    typeof p === "number" && [1, 2, 3].includes(p)
  );
};

const RECUR_INTERVAL_MS: Record<string, number> = {
  every_1_minute:  60_000,
  every_5_minutes: 300_000,
  every_1_hour:    3_600_000,
};

export const VALID_RECUR_INTERVALS = Object.keys(RECUR_INTERVAL_MS);

export const isValidRecurInterval = (interval: unknown): interval is string => {
  return typeof interval === "string" && interval in RECUR_INTERVAL_MS;
};

export const recurIntervalToMilliseconds = (interval: string): number => {
  const ms = RECUR_INTERVAL_MS[interval];
  if (ms === undefined) throw new Error(`Unknown recur interval: ${interval}`);
  return ms;
};

// ── helpers ──────────────────────────────────────────────────────────────

/** Parse a query string value to an integer. Returns NaN if invalid. */
export const toInt = (v: unknown): number => parseInt(v as string, 10);

/**
 * Parse a unix-ms timestamp string to a Date.
 * Returns null when the value is absent, an Error when it's present but bad.
 */
export const toDate = (v: unknown, field: string): Date | null | Error => {
    if (v === undefined) return null;
    const ms = Number(v);
    if (Number.isNaN(ms)) return new Error(`${field} must be a unix ms timestamp`);
    return new Date(ms);
};

