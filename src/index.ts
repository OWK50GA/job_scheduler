import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { router } from "./routes";

const app = express();
config();

const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  return res.json({
    status: "healthy",
  });
});

app.use("/api/v1", router);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
