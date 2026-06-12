import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  accentColor?: string;
  delta?: string;
  icon?: string;
  badge?: ReactNode;
  valueClassName?: string;
  children?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  accentColor,
  delta,
  icon,
  badge,
  valueClassName = "",
  children,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-outline-variant bg-surface-container p-4 shadow-panel ${className}`.trim()}
    >
      {accentColor ? (
        <div
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: accentColor }}
        />
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
              {label}
            </span>
            {badge}
          </div>
          <div
            className={`font-headline text-[28px] font-semibold leading-none text-on-surface ${valueClassName}`.trim()}
            style={accentColor ? { color: accentColor } : undefined}
          >
            {value}
          </div>
          {delta ? (
            <span className="font-code text-[11px] text-on-surface-variant">
              {delta}
            </span>
          ) : null}
        </div>
        {icon ? (
          <span
            className="material-symbols-outlined text-2xl text-on-surface-variant"
            style={accentColor ? { color: accentColor } : undefined}
          >
            {icon}
          </span>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
