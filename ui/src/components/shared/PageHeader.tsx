import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  badges?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  badges,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-headline text-[28px] font-semibold leading-none text-on-surface">
              {title}
            </h1>
            {badges}
          </div>
          {description ? (
            <p className="max-w-3xl font-body text-sm text-on-surface-variant">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
