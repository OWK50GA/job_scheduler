import { Request, Response, Router } from "express";
import { isValidJobPriority, isValidJobStatus, isValidRecurInterval, toDate, toInt, VALID_RECUR_INTERVALS } from "../utils";
import { DatabaseClient, InsertJobInput } from "../db";
import { JobQueryOptions, JobStatus, SortField, SortOrder } from "../types";

export const router = Router();

const dbClient = new DatabaseClient();

router.post("/jobs", async (req: Request, res: Response) => {
  const { type, payload, priority, scheduled_at, recur_interval } = req.body;

  if (!type || typeof type !== "string") {
    return res.status(400).json({
      status: "error",
      message: "type is required and must be a string",
    });
  }

  // payload must be a plain object - clients send JSON
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({
      status: "error",
      message: "payload is required and must be a JSON object",
    });
  }

  if (!priority || !isValidJobPriority(priority)) {
    return res.status(400).json({
      status: "error",
      message: "priority is required and must be 1 (high), 2 (medium), or 3 (low)",
    });
  }

  let scheduledDate: Date | undefined;

  if (scheduled_at !== undefined) {
    // Accept unix ms timestamp from clients - convert to Date for the DB
    const ms = Number(scheduled_at);
    if (Number.isNaN(ms)) {
      return res.status(400).json({
        status: "error",
        message: "scheduled_at must be a unix ms timestamp",
      });
    }
    if (ms < Date.now()) {
      return res.status(400).json({
        status: "error",
        message: "scheduled_at cannot be in the past",
      });
    }
    scheduledDate = new Date(ms);
  }

  if (recur_interval !== undefined && !isValidRecurInterval(recur_interval)) {
    return res.status(400).json({
      status: "error",
      message: `recur_interval must be one of: ${VALID_RECUR_INTERVALS.join(", ")}`,
    });
  }

  try {
    const input: InsertJobInput = {
      type,
      payload,
      priority,
      scheduled_at: scheduledDate,
      recur_interval,
    };

    const job = await dbClient.insertJob(input);

    return res.status(201).json({
      status: "success",
      data: job,
    });
  } catch (err) {
    console.error("Failed to insert job:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to create job",
    });
  }
});

router.get("/jobs", async (req: Request, res: Response) => {
  const {
    type,
    status,
    priority,
    limit,
    page,
    min_attempt_count,
    max_attempt_count,
    min_max_retries,
    max_max_retries,
    next_retry_before,
    next_retry_after,
    scheduled_before,
    scheduled_after,
    recur_interval,
    started_before,
    started_after,
    completed_before,
    completed_after,
    cancelled_before,
    cancelled_after,
    created_before,
    created_after,
    updated_before,
    updated_after,
    sort_by,
    sort_order,
  } = req.query;

  if (type !== undefined && typeof type !== "string") {
    return res.status(400).json({ status: "error", message: "type must be a string" });
  }

  if (status !== undefined && !isValidJobStatus(status)) {
    return res.status(400).json({
      status: "error",
      message: `status must be one of: ${Object.values(JobStatus).join(", ")}`,
    });
  }

  let parsedPriority: 1 | 2 | 3 | undefined;
  if (priority !== undefined) {
    const p = toInt(priority);
    if (![1, 2, 3].includes(p)) {
      return res.status(400).json({
        status: "error",
        message: "priority must be 1 (high), 2 (medium), or 3 (low)",
      });
    }
    parsedPriority = p as 1 | 2 | 3;
  }

  let parsedLimit: number | undefined;
  if (limit !== undefined) {
    parsedLimit = toInt(limit);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({ status: "error", message: "limit must be a positive integer" });
    }
  }

  let parsedPage: number | undefined;
  if (page !== undefined) {
    parsedPage = toInt(page);
    if (Number.isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({ status: "error", message: "page must be a positive integer" });
    }
  }

  let parsedMinAttempt: number | undefined;
  if (min_attempt_count !== undefined) {
    parsedMinAttempt = toInt(min_attempt_count);
    if (Number.isNaN(parsedMinAttempt) || parsedMinAttempt < 0) {
      return res.status(400).json({ status: "error", message: "min_attempt_count must be a non-negative integer" });
    }
  }

  let parsedMaxAttempt: number | undefined;
  if (max_attempt_count !== undefined) {
    parsedMaxAttempt = toInt(max_attempt_count);
    if (Number.isNaN(parsedMaxAttempt) || parsedMaxAttempt < 0) {
      return res.status(400).json({ status: "error", message: "max_attempt_count must be a non-negative integer" });
    }
  }

  let parsedMinMaxRetries: number | undefined;
  if (min_max_retries !== undefined) {
    parsedMinMaxRetries = toInt(min_max_retries);
    if (Number.isNaN(parsedMinMaxRetries) || parsedMinMaxRetries < 0) {
      return res.status(400).json({ status: "error", message: "min_max_retries must be a non-negative integer" });
    }
  }

  let parsedMaxMaxRetries: number | undefined;
  if (max_max_retries !== undefined) {
    parsedMaxMaxRetries = toInt(max_max_retries);
    if (Number.isNaN(parsedMaxMaxRetries) || parsedMaxMaxRetries < 0) {
      return res.status(400).json({ status: "error", message: "max_max_retries must be a non-negative integer" });
    }
  }

  if (recur_interval !== undefined && !isValidRecurInterval(recur_interval)) {
    return res.status(400).json({
      status: "error",
      message: `recur_interval must be one of: ${VALID_RECUR_INTERVALS.join(", ")}`,
    });
  }

  if (sort_by !== undefined && !["attempt_count", "max_retries", "priority"].includes(sort_by as string)) {
    return res.status(400).json({
      status: "error",
      message: "sort_by must be one of: attempt_count, max_retries, priority",
    });
  }

  if (sort_order !== undefined && !["asc", "desc"].includes((sort_order as string).toLowerCase())) {
    return res.status(400).json({
      status: "error",
      message: "sort_order must be asc or desc",
    });
  }

  const datePairs: [unknown, string][] = [
    [next_retry_before, "next_retry_before"],
    [next_retry_after, "next_retry_after"],
    [scheduled_before, "scheduled_before"],
    [scheduled_after, "scheduled_after"],
    [started_before, "started_before"],
    [started_after, "started_after"],
    [completed_before, "completed_before"],
    [completed_after, "completed_after"],
    [cancelled_before, "cancelled_before"],
    [cancelled_after, "cancelled_after"],
    [created_before, "created_before"],
    [created_after, "created_after"],
    [updated_before, "updated_before"],
    [updated_after, "updated_after"],
  ];

  const parsedDates: Record<string, Date | undefined> = {};
  for (const [value, field] of datePairs) {
    const result = toDate(value, field);
    if (result instanceof Error) {
      return res.status(400).json({ status: "error", message: result.message });
    }
    if (result !== null) parsedDates[field] = result;
  }

  try {
    const options: JobQueryOptions = {
      type: type as string | undefined,
      status: status as JobStatus | undefined,
      priority: parsedPriority,
      limit: parsedLimit,
      page: parsedPage,
      min_attempt_count: parsedMinAttempt,
      max_attempt_count: parsedMaxAttempt,
      min_max_retries: parsedMinMaxRetries,
      max_max_retries: parsedMaxMaxRetries,
      recur_interval: recur_interval as string | undefined,
      sort_by: sort_by as SortField | undefined,
      sort_order: sort_order as SortOrder | undefined,
      ...parsedDates,
    };

    const result = await dbClient.getAllJobs(options);

    return res.status(200).json({
      status: "success",
      data: result.records,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  } catch (err) {
    console.error("Failed to fetch jobs:", err);
    return res.status(500).json({ status: "error", message: "Failed to fetch jobs" });
  }
});

router.get("/jobs/dlq", async (req: Request, res: Response) => {
    // Should I do the same validation for getting all jobs, or just return everything?

    const options: JobQueryOptions = {
        status: JobStatus.FAILED,
    }

    const result = await dbClient.getAllJobs(options);

    return res.status(200).json({
        status: "success",
        data: result.records,
        meta: {
            page: result.page,
            limit: result.limit,
            total: result.total
        }
    })
})

router.get("/job/stats", async (req: Request, res: Response) => {

})

router.get("/jobs/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log(id);

    if (!id) {
        return res.status(400).json({
            status: "error",
            message: "Missing job id request param",
        });
    };

    if (typeof id !== 'string') {
        return res.status(422).json({
            status: "error",
            message: "Unprocessable entity",
        });
    };

    try {
        const job = await dbClient.getJob(id);

        if (!job || job === null || typeof job === 'undefined') {
            return res.status(404).json({
                status: "error",
                message: `Job with ${id} does not exist`,
            });
        };

        return res.status(200).json({
            status: "success",
            data: job,
        })
    } catch (err) {
        return res.status(500).json({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
        });
    };
})

router.post("/jobs/:id/cancel", async (req: Request, res: Response) => {

})

router.post("/jobs/:id/retry", async (req: Request, res: Response) => {

})