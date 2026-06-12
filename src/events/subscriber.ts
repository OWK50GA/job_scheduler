import Redis from "ioredis";
import { logger } from "../logger";
import { SCHEDULER_CHANNEL, SchedulerEvent } from "./types";

// ---------------------------------------------------------------------------
// SSE client registry
// ---------------------------------------------------------------------------

type SSEWriter = (event: SchedulerEvent) => void;

const clients = new Set<SSEWriter>();

export function addSSEClient(writer: SSEWriter): () => void {
  clients.add(writer);
  return () => clients.delete(writer);
}

// ---------------------------------------------------------------------------
// Singleton subscriber client
// ---------------------------------------------------------------------------

let sub: Redis | null = null;

/**
 * Start the Redis subscriber once per process.
 * Idempotent — safe to call multiple times.
 *
 * Key decisions:
 * - `enableReadyCheck: false` — suppresses the INFO ready-check that ioredis
 *   normally runs after connecting. A subscribed connection rejects INFO, which
 *   would trigger an error → reconnect → INFO loop.
 * - Subscribe on the `ready` event, not `connect`. ioredis fires `connect` when
 *   the TCP socket opens but before the connection is fully usable. `ready` is
 *   fired after the ready-check (or immediately when it is disabled).
 * - The subscribe callback is idempotent for our use case because we only
 *   subscribe once per process lifetime.
 */
export function startSubscriber(): void {
  if (sub) return;

  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");

  sub = new Redis(url, {
    enableReadyCheck: false, // ← prevents INFO on a subscribe connection
    retryStrategy: (times) => Math.min(times * 200, 10_000),
  });

  sub.on("error", (err: Error) =>
    logger.warn({ err }, "Redis subscriber error"),
  );

  // `ready` fires once when the connection is usable; after a reconnect it
  // fires again, but ioredis automatically re-subscribes to existing channels
  // on reconnect so we only need to subscribe on the first `ready`.
  sub.once("ready", () => {
    logger.info("Redis subscriber connected");
    sub!.subscribe(SCHEDULER_CHANNEL, (err) => {
      if (err) {
        logger.error({ err }, "Failed to subscribe to scheduler channel");
      } else {
        logger.info(
          { channel: SCHEDULER_CHANNEL },
          "Subscribed to scheduler channel",
        );
      }
    });
  });

  sub.on("message", (_channel: string, rawMessage: string) => {
    let event: SchedulerEvent;

    try {
      event = JSON.parse(rawMessage) as SchedulerEvent;
    } catch {
      logger.warn({ rawMessage }, "Received malformed event from Redis");
      return;
    }

    // Fan out to all connected SSE clients
    for (const writer of clients) {
      try {
        writer(event);
      } catch (err) {
        logger.warn({ err }, "SSE write failed — client likely disconnected");
        clients.delete(writer);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

export async function closeSubscriber(): Promise<void> {
  if (sub) {
    await sub.quit();
    sub = null;
  }
}
