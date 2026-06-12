/**
 * SchedulerEventsProvider
 *
 * Opens one EventSource for the whole app session. Pages subscribe to
 * specific event types via useSchedulerEvent() from ./useSchedulerEvent.
 *
 * This file exports ONLY the provider component so that react-refresh works
 * correctly. Types, the context object, and constants live in
 * ./SchedulerEventsContext.ts.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SchedulerEvent, SSEEventType } from "../types";
import {
  SchedulerEventsContext,
  SCHEDULER_EVENT_TYPES,
  type ListenerMap,
} from "./SchedulerEventsContext";

const SSE_URL = "/api/v1/events/stream";
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function SchedulerEventsProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);

  // Listener registry lives in a ref so it never causes re-renders and
  // is stable for the full lifetime of this component.
  const listenersMapRef = useRef<ListenerMap>(new Map());

  const subscribe = useCallback(
    (type: SSEEventType, listener: (event: SchedulerEvent) => void): (() => void) => {
      const map = listenersMapRef.current;
      if (!map.has(type)) map.set(type, new Set());
      map.get(type)!.add(listener);
      return () => map.get(type)?.delete(listener);
    },
    [],
  );

  useEffect(() => {
    const map = listenersMapRef.current;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let destroyed = false;

    function onNamedEvent(e: MessageEvent) {
      try {
        const event = JSON.parse(e.data as string) as SchedulerEvent;
        const listeners = map.get(event.type as SSEEventType);
        if (listeners) {
          for (const fn of listeners) {
            try {
              fn(event);
            } catch {
              /* listener errors are isolated */
            }
          }
        }
      } catch {
        // ignore malformed frames
      }
    }

    function connect() {
      if (destroyed) return;

      es = new EventSource(SSE_URL);

      es.onopen = () => {
        attempt = 0;
        setConnected(true);
      };

      for (const t of SCHEDULER_EVENT_TYPES) {
        es.addEventListener(t, onNamedEvent as EventListener);
      }

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
  }, []);

  return (
    <SchedulerEventsContext.Provider value={{ connected, subscribe }}>
      {children}
    </SchedulerEventsContext.Provider>
  );
}
