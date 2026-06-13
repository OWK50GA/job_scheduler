import { NextFunction, Request, Response } from "express";
import { DatabaseClient } from "../db";
import { publish } from "../events/publisher";
import { InsertJobInput, JobQueryOptions, JobStatus } from "../types";
import {
  CreateJobSchema,
  GetAllJobsSchema,
  GetDLQJobsSchema,
  GetSingleJobSchema,
} from "../validation";
import { AppError } from "../middleware";

const dbClient = new DatabaseClient();

export async function createJob(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { success, data, error } = CreateJobSchema.safeParse(req.body);
  if (!success) {
    const issue = error.issues[0];
    return res.status(400).json({
      status: "error",
      message: `${String(issue.path[0])}: ${issue.message}`,
    });
  }
  const { type, payload, priority, scheduled_at, recur_interval, depends_on } =
    data;

  try {
    // If a dependency is declared, verify the referenced job actually exists.
    // We don't restrict by status - the dependency may still be pending or
    // processing, and that's fine. checkDependenciesMet in processJob handles
    // the runtime gate. We only need to confirm the ID is valid.
    if (depends_on) {
      const dep = await dbClient.getJob(depends_on);
      if (!dep) {
        return res.status(400).json({
          status: "error",
          message: `depends_on: job ${depends_on} does not exist`,
        });
      }
    }

    const input: InsertJobInput = {
      type,
      payload,
      priority,
      scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined,
      recur_interval,
      depends_on,
    };

    const job = await dbClient.insertJob(input);

    if (!job) {
      throw new AppError(500, "Failed to create job");
    }

    // Notify all SSE clients that a new job has been queued
    publish({ type: "job.created", payload: { job } });

    // Stats change — push updated counts to the dashboard
    dbClient
      .getJobStats()
      .then((stats) => {
        publish({ type: "stats.updated", payload: { stats } });
      })
      .catch(() => {
        /* non-critical */
      });

    return res.status(201).json({
      status: "success",
      data: job,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAllJobs(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { success, data, error } = GetAllJobsSchema.safeParse(req.query);

  if (!success) {
    const issue = error.issues[0];
    return res.status(400).json({
      status: "error",
      message: `${String(issue.path[0])}: ${issue.message}`,
    });
  }

  try {
    const options: JobQueryOptions = {
      ...data,
      status: data.status as JobStatus | undefined,
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
    next(err);
  }
}

export async function getAllDLQJobs(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { success, data, error } = GetDLQJobsSchema.safeParse(req.query);

  if (!success) {
    const issue = error.issues[0];
    return res.status(400).json({
      status: "error",
      message: `${String(issue.path[0])}: ${issue.message}`,
    });
  }

  try {
    // page and limit always have values — schema applies defaults
    const result = await dbClient.getDLQJobs(data.page, data.limit);

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
    next(err);
  }
}

export async function getSingleJob(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { success, error, data } = GetSingleJobSchema.safeParse(req.params);

  if (!success) {
    const issue = error.issues[0];
    return res.status(400).json({
      status: "error",
      message: `${String(issue.path[0])}: ${issue.message}`,
    });
  }
  const { id } = data;

  try {
    const job = await dbClient.getJob(id);

    if (!job) {
      throw new AppError(404, `Job with ${id} does not exist`);
    }

    return res.status(200).json({
      status: "success",
      data: job,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelJob(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { success, error, data } = GetSingleJobSchema.safeParse(req.params);

  if (!success) {
    const issue = error.issues[0];
    return res.status(400).json({
      status: "error",
      message: `${String(issue.path[0])}: ${issue.message}`,
    });
  }

  const { id } = data;

  try {
    const job = await dbClient.getJob(id);

    if (!job) {
      throw new AppError(404, `Job with ${id} does not exist`);
    }

    const cancelledJob = await dbClient.cancelJob(id);

    if (!cancelledJob) {
      throw new AppError(
        409,
        `Your request conflicts with the current resource state`,
      );
    }

    publish({ type: "job.cancelled", payload: { job: cancelledJob } });
    dbClient
      .getJobStats()
      .then((stats) => {
        publish({ type: "stats.updated", payload: { stats } });
      })
      .catch(() => {
        /* non-critical */
      });

    return res.status(200).json({
      status: "success",
      data: cancelledJob,
    });
  } catch (err) {
    next(err);
  }
}

export async function manualRetryJob(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { success, error, data } = GetSingleJobSchema.safeParse(req.params);

  if (!success) {
    const issue = error.issues[0];
    return res.status(400).json({
      status: "error",
      message: `${String(issue.path[0])}: ${issue.message}`,
    });
  }

  const { id } = data;

  try {
    const job = await dbClient.getJob(id);

    if (!job) {
      throw new AppError(404, `Job with ${id} does not exist`);
    }

    const retriedJob = await dbClient.manualRetryJob(id);

    if (!retriedJob) {
      throw new AppError(
        409,
        `Your request conflicts with the current resource state`,
      );
    }

    // Re-queued from DLQ — treat as a new job.created so the stream reflects it
    publish({ type: "job.created", payload: { job: retriedJob } });
    dbClient
      .getJobStats()
      .then((stats) => {
        publish({ type: "stats.updated", payload: { stats } });
      })
      .catch(() => {
        /* non-critical */
      });

    return res.status(200).json({
      status: "success",
      data: retriedJob,
    });
  } catch (err) {
    next(err);
  }
}

export async function getJobStats(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const stats = await dbClient.getJobStats();

    return res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (err) {
    next(err);
  }
}

export async function purgeJob(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { success, error, data } = GetSingleJobSchema.safeParse(req.params);

  if (!success) {
    const issue = error.issues[0];
    return res.status(400).json({
      status: "error",
      message: `${String(issue.path[0])}: ${issue.message}`,
    });
  }

  const { id } = data;

  try {
    // Check existence first so we can distinguish 404 from 409
    const job = await dbClient.getJob(id);

    if (!job) {
      throw new AppError(404, `Job with id ${id} does not exist`);
    }

    const deleted = await dbClient.purgeJob(id);

    if (!deleted) {
      // Job exists but is not in the DLQ
      throw new AppError(
        409,
        "Job is not in the DLQ — only DLQ jobs can be purged",
      );
    }

    return res.status(200).json({
      status: "success",
      data: { id },
    });
  } catch (err) {
    next(err);
  }
}

export async function emptyDLQ(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { deleted } = await dbClient.emptyDLQ();

    // Push updated stats so the dashboard reflects the cleared DLQ immediately
    dbClient
      .getJobStats()
      .then((stats) => {
        publish({ type: "stats.updated", payload: { stats } });
      })
      .catch(() => {
        /* non-critical */
      });

    return res.status(200).json({
      status: "success",
      data: { deleted },
    });
  } catch (err) {
    next(err);
  }
}

export async function getJobAttempts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { success, error, data } = GetSingleJobSchema.safeParse(req.params);

  if (!success) {
    const issue = error.issues[0];
    return res.status(400).json({
      status: "error",
      message: `${String(issue.path[0])}: ${issue.message}`,
    });
  }

  const { id } = data;

  try {
    const job = await dbClient.getJob(id);

    if (!job) {
      throw new AppError(404, `Job with id ${id} does not exist`);
    }

    const attempts = await dbClient.getJobAttempts(id);

    return res.status(200).json({
      status: "success",
      data: attempts,
    });
  } catch (err) {
    next(err);
  }
}
