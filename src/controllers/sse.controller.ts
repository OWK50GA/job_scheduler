import { Request, Response } from "express";
import { addSSEClient } from "../events/subscriber";
import type { SchedulerEvent } from "../events/types";

/**
 * GET /api/v1/events/stream
 *
 * Server-Sent Events endpoint. Each connected client receives every
 * scheduler event published to the Redis channel in real time.
 *
 * Wire format:
 *   event: <SchedulerEventType>
 *   data: <JSON-serialised SchedulerEvent>
 *   \n\n
 *
 * The `event` field lets the browser's EventSource API dispatch to named
 * listeners:  eventSource.addEventListener('job.completed', handler)
 * A generic `message` listener also works since `data` always carries the
 * full event including its `type` field.
 */
export function sseHandler(req: Request, res: Response): void {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
  res.flushHeaders();

  // Send a heartbeat comment every 20 s to keep the connection alive through
  // proxies and load balancers that close idle connections.
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 20_000);

  // Register this client with the subscriber fan-out
  const remove = addSSEClient((event: SchedulerEvent) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    remove();
  });
}
