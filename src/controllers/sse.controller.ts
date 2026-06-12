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
 */
export function sseHandler(req: Request, res: Response): void {
  // Disable Nagle's algorithm — ensures each write() is flushed to the
  // socket immediately rather than being batched. Critical for SSE.
  if (req.socket) {
    req.socket.setNoDelay(true);
    req.socket.setTimeout(0); // disable socket idle timeout
  }

  // SSE headers — must be set before any write
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
  res.setHeader("Transfer-Encoding", "identity");

  // Express 5 compatibility: use writeHead + write rather than flushHeaders
  // to ensure the response stream opens immediately.
  res.writeHead(200);

  // Send an initial comment to confirm the stream is open.
  // Some proxies and the browser EventSource API wait for first bytes.
  res.write(": connected\n\n");

  // Heartbeat every 20 s to keep the connection alive through proxies
  // and load balancers that close idle connections.
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": heartbeat\n\n");
    }
  }, 20_000);

  // Register this client with the subscriber fan-out
  const remove = addSSEClient((event: SchedulerEvent) => {
    if (res.writableEnded) return;
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    remove();
  });
}
