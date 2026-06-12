import swaggerJSDoc, { Options } from "swagger-jsdoc";

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Job Scheduler API",
      version: "1.0.0",
      description:
        "A background job scheduler with priority queues, retries, DLQ, DAG workflows, and recurring jobs.",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT ?? 3002}/api/v1`,
        description: "Development server",
      },
      {
        url: `https://${process.env.PRODUCTION_HOST ?? "hngtask1wilfrid.mooo.com"}/api/v1`,
        description: "Production server",
      },
    ],
    components: {
      schemas: {
        Job: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            type: { type: "string", example: "send_email" },
            payload: { type: "object", additionalProperties: true },
            status: {
              type: "string",
              enum: [
                "pending",
                "processing",
                "completed",
                "failed",
                "cancelled",
              ],
            },
            priority: {
              type: "integer",
              enum: [1, 2, 3],
              description: "1=high, 2=medium, 3=low",
            },
            attempt_count: { type: "integer" },
            max_retries: { type: "integer" },
            next_retry_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            scheduled_at: { type: "string", format: "date-time" },
            recur_interval: {
              type: "string",
              nullable: true,
              enum: ["every_1_minute", "every_5_minutes", "every_1_hour"],
            },
            last_error: { type: "string", nullable: true },
            result: {
              type: "object",
              nullable: true,
              additionalProperties: true,
            },
            started_at: { type: "string", format: "date-time", nullable: true },
            completed_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            cancelled_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        JobStats: {
          type: "object",
          properties: {
            pending: { type: "integer" },
            processing: { type: "integer" },
            completed: { type: "integer" },
            failed: { type: "integer" },
            cancelled: { type: "integer" },
            dlq: { type: "integer" },
            total: { type: "integer" },
          },
        },
        PaginatedJobs: {
          type: "object",
          properties: {
            status: { type: "string", example: "success" },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Job" },
            },
            meta: {
              type: "object",
              properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "error" },
            message: { type: "string" },
          },
        },
      },
    },
  },
  // Point at route files where JSDoc @swagger comments will live
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);
