/**
 * Hooks for consuming the SchedulerEvents context.
 * Kept in a separate file so react-refresh/only-export-components is satisfied:
 * the provider file exports only a component; this file exports only hooks.
 */

import { useContext, useEffect, useRef } from "react";
import type { SchedulerEvent, SSEEventType } from "../types";
import {
  type Listener,
  SchedulerEventsContext,
} from "./SchedulerEventsContext";

/**
 * Subscribe to a specific scheduler event type.
 * The listener is called whenever an event of that type arrives.
 * The subscription is cleaned up when the component unmounts.
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

  // Keep a ref to the latest listener so the subscription closure is stable
  // (never torn down on re-render) while always calling the current version.
  const listenerRef = useRef(listener);

  useEffect(() => {
    // Update the ref inside the effect, not during render, to satisfy
    // react-hooks/refs which forbids writing refs during the render phase.
    listenerRef.current = listener;
  });

  useEffect(() => {
    const stable: Listener = (event) => {
      if (event.type === type) {
        listenerRef.current(event as Extract<SchedulerEvent, { type: T }>);
      }
    };
    return subscribe(type, stable);
    // `subscribe` is stable (useCallback with no deps); `type` is a string
    // literal that should not change. Both are correct deps.
  }, [type, subscribe]);
}

/**
 * Returns whether the SSE connection is currently open.
 */
export function useSSEConnected(): boolean {
  return useContext(SchedulerEventsContext).connected;
}

/**
 * Returns whether the SSE connection is currently attempting to reconnect.
 */
export function useSSEReconnecting(): boolean {
  return useContext(SchedulerEventsContext).reconnecting;
}
