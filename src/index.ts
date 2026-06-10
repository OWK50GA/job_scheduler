import express from "express";
import cors from "cors";
import { config } from "dotenv";
import swaggerUi from "swagger-ui-express";
import { router } from "./routes";
import { swaggerSpec } from "./config";
import { errorHandler } from "./middleware";

const app = express();
config();

const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api-docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.get("/health", (req, res) => {
  return res.json({
    status: "healthy",
  });
});

app.use("/api/v1", router);

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
