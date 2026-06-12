interface MockBadgeProps {
  label?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  className?: string;
}

const toneClasses: Record<NonNullable<MockBadgeProps["tone"]>, string> = {
  neutral:
    "border-outline bg-surface-container-highest/40 text-on-surface-variant",
  info: "border-primary/40 bg-primary/10 text-primary",
  success: "border-secondary/40 bg-secondary/10 text-secondary",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  danger: "border-error/40 bg-error/10 text-error",
};

export function MockBadge({
  label = "Dummy Data",
  tone = "neutral",
  className = "",
}: MockBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-body text-[10px] font-semibold uppercase tracking-technical",
        toneClasses[tone],
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
