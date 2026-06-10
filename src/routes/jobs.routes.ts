import { Request, Response, Router } from "express";
import {
  createJob,
  getAllDLQJobs,
  getAllJobs,
  getSingleJob,
} from "../controllers";

export const router = Router();

router.post("/jobs", createJob);

router.get("/jobs", getAllJobs);

router.get("/jobs/dlq", getAllDLQJobs);

router.get("/job/stats", async (req: Request, res: Response) => {});

router.get("/jobs/:id", getSingleJob);

router.post("/jobs/:id/cancel", async (req: Request, res: Response) => {});

router.post("/jobs/:id/retry", async (req: Request, res: Response) => {});
