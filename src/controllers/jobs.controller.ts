import { NextFunction, Request, Response } from "express";
import { DatabaseClient } from "../db";
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
  const { type, payload, priority, scheduled_at, recur_interval } = data;

  try {
    const input: InsertJobInput = {
      type,
      payload,
      priority,
      scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined,
      recur_interval,
    };

    const job = await dbClient.insertJob(input);

    if (!job) {
      throw new AppError(500, "Failed to create job");
    }

    return res.status(201).json({
      status: "success",
      data: job,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAllJobs(req: Request, res: Response) {
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
      status: data.status as JobStatus,
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
    return res
      .status(500)
      .json({ status: "error", message: "Failed to fetch jobs" });
  }
}

export async function getAllDLQJobs(req: Request, res: Response) {
  const { success, data, error } = GetDLQJobsSchema.safeParse(req.query);

  if (!success) {
    const issue = error.issues[0];
    return res.status(400).json({
      status: "error",
      message: `${String(issue.path[0])}: ${issue.message}`,
    });
  }

  const { page, limit } = data;

  try {
    const result = await dbClient.getDLQJobs(
      page ? page : undefined,
      limit ? limit : undefined,
    );

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
    return res.status(500).json({
      status: "error",
      message:
        err instanceof Error ? `Internal Server Error: ${err.message}` : err,
    });
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
