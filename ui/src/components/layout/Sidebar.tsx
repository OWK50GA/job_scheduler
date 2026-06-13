import { NavLink, useLocation } from "react-router-dom";

type NavItem = {
  label: string;
  icon: string;
  path?: string;
  match?: (pathname: string) => boolean;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: "dashboard",
    match: (pathname) => pathname === "/",
  },
  {
    label: "Jobs",
    path: "/jobs",
    icon: "terminal",
    match: (pathname) => pathname === "/jobs" || pathname === "/jobs/new",
  },
  {
    label: "DLQ",
    path: "/jobs/dlq",
    icon: "data_alert",
    match: (pathname) => pathname.startsWith("/jobs/dlq"),
  },
  // { label: "Metrics", icon: "monitoring", disabled: true },
  // { label: "Infrastructure", icon: "dns", disabled: true },
  // {
  //   label: "Settings",
  //   path: "/settings",
  //   icon: "settings",
  //   match: (pathname) => pathname === "/settings",
  // },
];

const footerLinks = [
  { label: "Docs", icon: "description", href: "/api-docs" },
  { label: "Status", icon: "check_circle", href: null },
];

function itemClassName(active: boolean, disabled = false) {
  const base =
    "group flex items-center gap-3 px-4 py-2.5 font-body text-sm transition duration-150";

  if (disabled) {
    return `${base} cursor-not-allowed text-on-surface-variant/55`;
  }

  if (active) {
    return `${base} border-r-2 border-primary bg-primary-container text-on-surface`;
  }

  return `${base} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface`;
}

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-[240px] flex-col border-r border-outline-variant bg-surface px-1 py-1">
      <div className="mb-2 px-5 py-6">
        <h1 className="font-headline text-[16px] font-semibold uppercase tracking-[0.12em] text-on-surface">
          Job Scheduler
        </h1>
        <p className="mt-1 font-code text-[11px] text-on-surface-variant/70">
          v0.0.1
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const active = item.match?.(location.pathname) ?? false;

          if (!item.path || item.disabled) {
            return (
              <button
                key={item.label}
                type="button"
                disabled
                className={itemClassName(false, true)}
                aria-disabled="true"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.path === "/"}
              className={() => itemClassName(active)}
            >
              <span className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 px-2 pb-5">
        {/* <Button
          icon="rocket_launch"
          variant="secondary"
          className="w-full border-on-surface bg-on-surface text-surface hover:bg-white/90"
        >
          Deploy New Node
        </Button> */}

        <div className="space-y-1">
          {footerLinks.map((link) =>
            link.href ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-3 px-4 py-2 font-body text-xs text-on-surface-variant transition hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </a>
            ) : (
              <button
                key={link.label}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2 font-body text-xs text-on-surface-variant transition hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </button>
            ),
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-outline-variant px-4 pt-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-surface-container-highest text-on-surface">
            <span className="material-symbols-outlined text-[18px]">
              person
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-body text-sm font-semibold text-on-surface">
              Admin
            </span>
            <span className="font-body text-[10px] text-on-surface-variant">
              System Admin
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
