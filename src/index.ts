import express from "express";
import cors from "cors";
import { config } from "dotenv";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { router } from "./routes";
import { swaggerSpec } from "./config";
import { errorHandler } from "./middleware";
import { logger } from "./logger";

config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
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

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT }, "API server started");
});
