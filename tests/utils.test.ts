import { describe, it, expect } from "vitest";
import {
  isValidJobStatus,
  isValidJobPriority,
  isValidRecurInterval,
  recurIntervalToMilliseconds,
  VALID_RECUR_INTERVALS,
} from "../src/utils";
import { JobStatus } from "../src/types";

describe("isValidJobStatus", () => {
  it("accepts valid statuses", () => {
    for (const status of Object.values(JobStatus)) {
      expect(isValidJobStatus(status)).toBe(true);
    }
  });

  it("rejects unknown status strings", () => {
    expect(isValidJobStatus("running")).toBe(false);
    expect(isValidJobStatus("done")).toBe(false);
    expect(isValidJobStatus("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidJobStatus(null)).toBe(false);
    expect(isValidJobStatus(1)).toBe(false);
    expect(isValidJobStatus(undefined)).toBe(false);
  });
});

describe("isValidJobPriority", () => {
  it("accepts 1, 2, 3", () => {
    expect(isValidJobPriority(1)).toBe(true);
    expect(isValidJobPriority(2)).toBe(true);
    expect(isValidJobPriority(3)).toBe(true);
  });

  it("rejects out-of-range numbers", () => {
    expect(isValidJobPriority(0)).toBe(false);
    expect(isValidJobPriority(4)).toBe(false);
    expect(isValidJobPriority(-1)).toBe(false);
  });

  it("rejects non-number types", () => {
    expect(isValidJobPriority("1")).toBe(false);
    expect(isValidJobPriority(null)).toBe(false);
  });
});

describe("isValidRecurInterval", () => {
  it("accepts all defined intervals", () => {
    for (const interval of VALID_RECUR_INTERVALS) {
      expect(isValidRecurInterval(interval)).toBe(true);
    }
  });

  it("rejects unknown intervals", () => {
    expect(isValidRecurInterval("every_2_minutes")).toBe(false);
    expect(isValidRecurInterval("daily")).toBe(false);
    expect(isValidRecurInterval("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidRecurInterval(60000)).toBe(false);
    expect(isValidRecurInterval(null)).toBe(false);
  });
});

describe("recurIntervalToMilliseconds", () => {
  it("returns correct ms for each interval", () => {
    expect(recurIntervalToMilliseconds("every_1_minute")).toBe(60_000);
    expect(recurIntervalToMilliseconds("every_5_minutes")).toBe(300_000);
    expect(recurIntervalToMilliseconds("every_1_hour")).toBe(3_600_000);
  });

  it("throws on unknown interval", () => {
    expect(() => recurIntervalToMilliseconds("every_2_days")).toThrow();
  });
});
