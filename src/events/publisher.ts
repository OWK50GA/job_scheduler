import Redis from "ioredis";
import { logger } from "../logger";
import { SCHEDULER_CHANNEL, SchedulerEvent } from "./types";

// ---------------------------------------------------------------------------
// Singleton publisher client
// ---------------------------------------------------------------------------

let pub: Redis | null = null;

function getPublisher(): Redis {
  if (!pub) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");

    pub = new Redis(url, {
      // Reconnect with capped exponential backoff (max 10 s)
      retryStrategy: (times) => Math.min(times * 200, 10_000),
      lazyConnect: false,
    });

    pub.on("error", (err: Error) =>
      logger.warn({ err }, "Redis publisher error"),
    );
    pub.on("connect", () => logger.info("Redis publisher connected"));
  }
  return pub;
}

// ---------------------------------------------------------------------------
// publish
// ---------------------------------------------------------------------------

/**
 * Serialize `event` to JSON and publish it to the shared scheduler channel.
 * Fire-and-forget — errors are logged but never thrown to the caller.
 */
export function publish(event: SchedulerEvent): void {
  const client = getPublisher();
  const payload = JSON.stringify(event);

  client.publish(SCHEDULER_CHANNEL, payload).catch((err: unknown) => {
    logger.warn({ err, eventType: event.type }, "Failed to publish event");
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

export async function closePublisher(): Promise<void> {
  if (pub) {
    await pub.quit();
    pub = null;
  }
}
