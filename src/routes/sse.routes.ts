import { Router } from "express";
import { sseHandler } from "../controllers/sse.controller";

export const sseRouter = Router();

/**
 * @swagger
 * /events/stream:
 *   get:
 *     summary: Server-Sent Events stream
 *     description: >
 *       Opens a persistent SSE connection. The server pushes every scheduler
 *       event in real time. Each SSE frame has a named `event` field matching
 *       the SchedulerEventType, and a `data` field containing the full
 *       JSON-serialised event object.
 *     tags: [Events]
 *     produces:
 *       - text/event-stream
 *     responses:
 *       200:
 *         description: Stream opened — events pushed as they occur
 */
sseRouter.get("/stream", sseHandler);
