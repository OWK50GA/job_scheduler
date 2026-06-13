/**
 * Context definition and related types/constants for the SchedulerEvents system.
 * Kept in a separate file so react-refresh/only-export-components is satisfied:
 * the provider file exports only the component; this file exports only
 * non-component values.
 */

import { createContext } from "react";
import type { SchedulerEvent, SSEEventType } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Listener = (event: SchedulerEvent) => void;
export type ListenerMap = Map<SSEEventType, Set<Listener>>;

export type SchedulerEventsContextValue = {
  connected: boolean;
  reconnecting: boolean;
  subscribe: (type: SSEEventType, listener: Listener) => () => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const SchedulerEventsContext =
  createContext<SchedulerEventsContextValue>({
    connected: false,
    reconnecting: false,
    subscribe: () => () => {},
  });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCHEDULER_EVENT_TYPES: SSEEventType[] = [
  "job.created",
  "job.started",
  "job.completed",
  "job.failed",
  "job.retry_scheduled",
  "job.cancelled",
  "job.dlq_entry",
  "stats.updated",
];
