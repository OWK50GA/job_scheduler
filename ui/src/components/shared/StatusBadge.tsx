import type { JobStatus } from "../../types";

interface StatusMeta {
  label: string;
  icon: string;
  className: string;
  iconClassName?: string;
}

const STATUS_META: Record<JobStatus, StatusMeta> = {
  processing: {
    label: "Processing",
    icon: "refresh",
    className: "border-primary/50 bg-primary/10 text-primary",
    iconClassName: "animate-spin",
  },
  completed: {
    label: "Completed",
    icon: "done_all",
    className: "border-secondary/50 bg-secondary/10 text-secondary",
  },
  failed: {
    label: "Failed",
    icon: "error_outline",
    className: "border-error/50 bg-error/10 text-error",
  },
  pending: {
    label: "Queued",
    icon: "schedule",
    className:
      "border-outline/70 bg-surface-container-high text-on-surface-variant",
  },
  cancelled: {
    label: "Cancelled",
    icon: "block",
    className:
      "border-outline/70 bg-surface-container-high text-on-surface-variant",
  },
};

interface StatusBadgeProps {
  status: JobStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border-l-2 px-2 py-1 font-code text-[10px] font-semibold uppercase tracking-technical ${meta.className}`.trim()}
    >
      <span
        className={`material-symbols-outlined text-[14px] ${meta.iconClassName ?? ""}`.trim()}
      >
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}
