import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: isDev ? "debug" : "info",

  // pino serializes Error objects as plain objects by default.
  // The built-in err serializer captures message, stack, type, and code.
  serializers: {
    err: pino.stdSerializers.err,
  },

  // In dev, pipe through pino-pretty for human-readable output.
  // In production, raw NDJSON — fast and parseable by log aggregators.
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});
