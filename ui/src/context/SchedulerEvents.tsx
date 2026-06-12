/**
 * SchedulerEvents context
 *
 * Opens a single EventSource to /api/v1/events/stream for the entire app
 * session. Any component or page can subscribe to specific event types by
 * calling useSchedulerEvent(). Navigation between pages never closes or
 * reopens the connection.
 *
 * Usage:
 *   // In a page component
 *   useSchedulerEvent('stats.updated', (event) => {
 *     setStats(event.payload.stats);
 *   });
 *
 *   useSchedulerEvent('job.dlq_entry', (event) => {
 *     setDlqJobs(prev => [event.payload.job, ...prev]);
 *   });
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SchedulerEvent, SSEEventType } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = (event: SchedulerEvent) => void;
type ListenerMap = Map<SSEEventType, Set<Listener>>;

type SchedulerEventsContextValue = {
  connected: boolean;
  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  subscribe: (type: SSEEventType, listener: Listener) => () => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SchedulerEventsContext = createContext<SchedulerEventsContextValue>({
  connected: false,
  subscribe: () => () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const SSE_URL = "/api/v1/events/stream";
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function SchedulerEventsProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);

  // Listener registry lives in a ref so it never causes re-renders and doesn't
  // need to be a dependency of the connection effect.
  const listenersRef = useRef<ListenerMap>(new Map());

  const subscribe = useCallback(
    (type: SSEEventType, listener: Listener): (() => void) => {
      const map = listenersRef.current;
      if (!map.has(type)) map.set(type, new Set());
      map.get(type)!.add(listener);
      return () => map.get(type)?.delete(listener);
    },
    [],
  );

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      es = new EventSource(SSE_URL);

      es.onopen = () => {
        attempt = 0;
        setConnected(true);
      };

      // Named event listener — the server sends `event: <type>` frames, so the
      // browser dispatches them as named events rather than generic `message`.
      // We register one listener for all event type names.
      function onNamedEvent(e: MessageEvent) {
        try {
          const event = JSON.parse(e.data as string) as SchedulerEvent;
          const listeners = listenersRef.current.get(event.type as SSEEventType);
          if (listeners) {
            for (const fn of listeners) {
              try { fn(event); } catch { /* listener errors are isolated */ }
            }
          }
        } catch {
          // ignore malformed frames
        }
      }

      // Register for every known event type name so named SSE frames are caught
      const EVENT_TYPES: SSEEventType[] = [
        "job.created",
        "job.started",
        "job.completed",
        "job.failed",
        "job.retry_scheduled",
        "job.cancelled",
        "job.dlq_entry",
        "stats.updated",
      ];
      for (const t of EVENT_TYPES) {
        es.addEventListener(t, onNamedEvent as EventListener);
      }

      // Fallback: also handle generic `message` events (for any unnamed frames)
      es.onmessage = onNamedEvent;

      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;

        if (!destroyed) {
          const delay = Math.min(
            RECONNECT_BASE_MS * 2 ** attempt,
            RECONNECT_MAX_MS,
          );
          attempt += 1;
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []); // runs once per app session

  return (
    <SchedulerEventsContext.Provider value={{ connected, subscribe }}>
      {children}
    </SchedulerEventsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Subscribe to a specific scheduler event type.
 *
 * @example
 * useSchedulerEvent('stats.updated', (e) => setStats(e.payload.stats));
 * useSchedulerEvent('job.dlq_entry', (e) => addToDlq(e.payload.job));
 */
export function useSchedulerEvent<T extends SSEEventType>(
  type: T,
  listener: (event: Extract<SchedulerEvent, { type: T }>) => void,
): void {
  const { subscribe } = useContext(SchedulerEventsContext);

  // Stable ref so the subscription doesn't tear down on every render
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const stable: Listener = (event) => {
      if (event.type === type) {
        listenerRef.current(event as Extract<SchedulerEvent, { type: T }>);
      }
    };
    return subscribe(type, stable);
  }, [type, subscribe]);
}

/**
 * Returns the current SSE connection state.
 */
export function useSSEConnected(): boolean {
  return useContext(SchedulerEventsContext).connected;
}
