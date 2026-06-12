import { useLocation } from "react-router-dom";

const routeMeta: { match: (pathname: string) => boolean; title: string }[] = [
  { match: (pathname) => pathname === "/", title: "InfraGuard" },
  { match: (pathname) => pathname === "/jobs", title: "InfraStream" },
  { match: (pathname) => pathname === "/jobs/new", title: "InfraStream" },
  {
    match: (pathname) => pathname.startsWith("/jobs/dlq"),
    title: "InfraStream",
  },
  { match: (pathname) => pathname === "/settings", title: "InfraStream" },
];

const searchPlaceholders: {
  match: (pathname: string) => boolean;
  value: string;
}[] = [
  {
    match: (pathname) => pathname.startsWith("/jobs/dlq"),
    value: "Search failed jobs...",
  },
  {
    match: (pathname) => pathname === "/jobs",
    value: "Search jobs, IDs, or workers...",
  },
  {
    match: (pathname) => pathname === "/",
    value: "Search systems...",
  },
];

export default function TopBar() {
  const location = useLocation();

  const title =
    routeMeta.find((entry) => entry.match(location.pathname))?.title ??
    "InfraStream";

  const searchPlaceholder =
    searchPlaceholders.find((entry) => entry.match(location.pathname))?.value ??
    "Search systems...";

  return (
    <header className="fixed left-[240px] right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-outline-variant bg-surface px-6">
      <div className="flex items-center gap-6">
        <span className="font-headline text-[24px] font-semibold leading-none text-primary">
          {title}
        </span>
        <label className="relative hidden lg:block">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="h-8 w-72 rounded border border-outline-variant bg-surface-container-lowest pl-10 pr-4 font-body text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="rounded p-1.5 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          aria-label="Help"
        >
          <span className="material-symbols-outlined">help_outline</span>
        </button>
        <div className="h-4 w-px bg-outline-variant"></div>
        <button
          type="button"
          className="font-body text-xs font-medium text-on-surface-variant transition hover:text-on-surface"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
