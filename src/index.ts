import express, { Request, Response } from "express";
import cors from "cors";
import { config } from "dotenv";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { router } from "./routes";
import { swaggerSpec } from "./config";
import { errorHandler } from "./middleware";
import { logger } from "./logger";
import { envConfig } from "./config/env";

config();

export const app = express();
const PORT = envConfig.PORT;

app.use(cors({ origin: envConfig.CORS_ORIGIN }));
app.use(express.json());

// Structured HTTP request/response logging.
// Logs method, url, statusCode, responseTime on every request.
// Skips health check endpoint to avoid log noise.
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/health",
    },
  }),
);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api-docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

app.use("/api/v1", router);

app.use((req: Request, res: Response) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);

    return res.status(404).json({
      error: "Not Found",
      message: `Cannot ${req.method} ${req.originalUrl}`,
      "available-endpoints": {
        root: "GET /",
        health: "GET /health",
        docs: "GET /api-docs",
      },
    });
});

app.use(errorHandler);

app.listen(PORT, () => {
  // logger.info({ port: PORT }, "API server started");
  logger.info([
    "🚀 Server started successfully!",
        `Environment: ${envConfig.NODE_ENV}`,
        `Host: ${envConfig.HOST}`,
        `Port: ${envConfig.PORT}`,
        `Database: ${envConfig.JOB_SCHEDULER_DB_URL}`,
        `Started at: ${new Date().toLocaleString()}`,
        `API Root: http://${envConfig.HOST}:${envConfig.PORT}/`,
        `API Docs: http://${envConfig.HOST}:${envConfig.PORT}/api-docs`,
  ])
});
