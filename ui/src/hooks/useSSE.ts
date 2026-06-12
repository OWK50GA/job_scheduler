import { useEffect, useRef, useState } from "react";
import type { SSEEvent, Job } from "../types";

const INTERVAL_DEFAULT = 3000;
const INTERVAL_MIN = 1000;
const INTERVAL_MAX = 60000;

function clampInterval(ms: number): number {
  return Math.min(Math.max(ms, INTERVAL_MIN), INTERVAL_MAX);
}

// DUMMY DATA
const MOCK_JOB: Job = {
  id: "job-mock-0001",
  type: "ASYNC_TASK",
  payload: { task: "send-report", recipient: "ops@example.com" },
  status: "processing",
  priority: 2,
  attempt_count: 1,
  max_retries: 3,
  next_retry_at: null,
  scheduled_at: new Date().toISOString(),
  recur_interval: null,
  last_error: null,
  result: null,
  started_at: new Date().toISOString(),
  completed_at: null,
  cancelled_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// DUMMY DATA
const MOCK_STATUSES: Job["status"][] = [
  "pending",
  "processing",
  "completed",
  "failed",
];

function buildMockEvent(): SSEEvent {
  // DUMMY DATA
  const status =
    MOCK_STATUSES[Math.floor(Math.random() * MOCK_STATUSES.length)];
  return {
    type: "job.updated",
    payload: {
      ...MOCK_JOB,
      status,
      updated_at: new Date().toISOString(),
    },
  };
}

export function useSSE({
  mockMode,
  intervalMs: intervalMsRaw,
  onEvent,
}: {
  mockMode: boolean;
  intervalMs?: number;
  onEvent?: (event: SSEEvent) => void;
}): {
  data: SSEEvent | null;
  connected: boolean;
} {
  const intervalMs = clampInterval(intervalMsRaw ?? INTERVAL_DEFAULT);

  const [data, setData] = useState<SSEEvent | null>(null);
  const [serverConnected, setServerConnected] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Stable ref for onEvent so it doesn't force effect re-runs.
  // Assigned inside a layout effect to avoid the "ref write during render" lint rule.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (mockMode) {
      intervalRef.current = setInterval(() => {
        const nextEvent = buildMockEvent();
        setData(nextEvent);
        onEventRef.current?.(nextEvent);
      }, intervalMs);
    } else {
      function connect() {
        const es = new EventSource("/api/jobs/stream");
        eventSourceRef.current = es;

        es.onopen = () => {
          setServerConnected(true);
        };

        es.onmessage = (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data as string) as SSEEvent;
            setData(parsed);
            onEventRef.current?.(parsed);
          } catch {
            // ignore malformed messages
          }
        };

        es.onerror = () => {
          setServerConnected(false);
          es.close();
          eventSourceRef.current = null;

          timeoutRef.current = setTimeout(() => {
            connect();
          }, intervalMs);
        };
      }

      connect();
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (eventSourceRef.current !== null) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [mockMode, intervalMs]);

  return { data, connected: mockMode || serverConnected };
}
