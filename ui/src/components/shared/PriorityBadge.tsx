type Priority = 1 | 2 | 3;

const PRIORITY_META: Record<
  Priority,
  { label: string; bar: string; text: string; bg: string }
> = {
  1: {
    label: "Critical",
    bar: "bg-error",
    text: "text-error",
    bg: "bg-error/10",
  },
  2: {
    label: "Med",
    bar: "bg-primary",
    text: "text-primary",
    bg: "bg-primary/10",
  },
  3: {
    label: "Low",
    bar: "bg-outline",
    text: "text-on-surface-variant",
    bg: "bg-surface-container-high",
  },
};

interface PriorityBadgeProps {
  priority: Priority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const meta = PRIORITY_META[priority];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-sm px-2 py-1 font-code text-[10px] font-semibold uppercase tracking-technical ${meta.bg} ${meta.text}`.trim()}
    >
      <span className={`h-3 w-1 rounded-full ${meta.bar}`}></span>
      {meta.label}
    </span>
  );
}
