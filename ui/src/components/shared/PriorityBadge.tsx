type Priority = 1 | 2 | 3;

const PRIORITY_LABELS: Record<Priority, string> = {
  1: "HIGH",
  2: "MED",
  3: "LOW",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#475569",
};

interface PriorityBadgeProps {
  priority: Priority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      style={{
        backgroundColor: PRIORITY_COLORS[priority],
        color: "#ffffff",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "0.7rem",
        fontWeight: 600,
        letterSpacing: "0.05em",
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
