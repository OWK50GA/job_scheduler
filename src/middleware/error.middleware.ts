import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    res.status(400).json({
      status: "error",
      message: `${String(issue.path[0]) || "input"}: ${issue.message}`,
    });
    return;
  }

  // Unknown error — log it with full context
  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");

  res.status(500).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err instanceof Error
          ? err.message
          : String(err),
  });
}
