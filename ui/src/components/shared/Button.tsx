import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string;
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 font-body text-[11px] font-semibold uppercase tracking-technical transition duration-150 disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-on-primary hover:brightness-110 active:brightness-95",
  secondary:
    "border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container-high",
  ghost:
    "border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  danger:
    "border-error bg-error text-on-error hover:brightness-110 active:brightness-95",
  link: "border-transparent bg-transparent px-0 py-0 text-primary hover:text-on-surface",
};

export function Button({
  icon,
  variant = "secondary",
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    >
      {icon ? (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
