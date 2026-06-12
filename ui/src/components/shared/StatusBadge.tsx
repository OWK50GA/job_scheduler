import type { JobStatus } from "../../types";

const STATUS_COLORS: Record<JobStatus, string> = {
  processing: "#0ea5e9",
  completed: "#10b981",
  failed: "#ef4444",
  pending: "#f59e0b",
  cancelled: "#475569",
};

interface StatusBadgeProps {
  status: JobStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      style={{
        backgroundColor: STATUS_COLORS[status],
        color: "#ffffff",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "0.7rem",
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}
