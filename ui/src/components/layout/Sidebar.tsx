import { NavLink, useLocation } from "react-router-dom";

type NavItem =
  | { label: string; path: string; icon: string; navigable: true }
  | { label: string; path?: undefined; icon: string; navigable: false };

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/", icon: "dashboard", navigable: true },
  { label: "Jobs", path: "/jobs", icon: "work", navigable: true },
  { label: "DLQ", path: "/jobs/dlq", icon: "report_problem", navigable: true },
  { label: "Metrics", icon: "bar_chart", navigable: false },
  { label: "Infrastructure", icon: "dns", navigable: false },
  { label: "Settings", path: "/settings", icon: "settings", navigable: true },
];

const ACTIVE_STYLE: React.CSSProperties = {
  borderLeft: "4px solid #0ea5e9",
  backgroundColor: "#0c4a6e",
};

const INACTIVE_STYLE: React.CSSProperties = {
  borderLeft: "4px solid transparent",
  backgroundColor: "transparent",
};

const ITEM_BASE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 16px",
  width: "100%",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  border: "none",
  textAlign: "left",
  transition: "background-color 0.15s ease",
};

export default function Sidebar() {
  const location = useLocation();

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: "240px",
        minWidth: "240px",
        backgroundColor: "#0f172a",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        overflowY: "auto",
      }}
    >
      {/* Logo / App name */}
      <div
        style={{
          padding: "24px 20px 20px",
          fontSize: "18px",
          fontWeight: 700,
          color: "#0ea5e9",
          letterSpacing: "0.01em",
          userSelect: "none",
        }}
      >
        Job Scheduler
      </div>

      {/* Nav items */}
      <ul
        role="list"
        style={{ listStyle: "none", margin: 0, padding: 0, flex: 1 }}
      >
        {navItems.map((item) => {
          if (item.navigable) {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.label}>
                <NavLink
                  to={item.path}
                  end
                  style={({ isActive: navActive }) => ({
                    ...ITEM_BASE,
                    ...(navActive ? ACTIVE_STYLE : INACTIVE_STYLE),
                    color: navActive ? "#f8fafc" : "#94a3b8",
                  })}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className="material-icons"
                    aria-hidden="true"
                    style={{ fontSize: "20px" }}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              </li>
            );
          }

          // No-op item
          return (
            <li key={item.label}>
              <button
                type="button"
                disabled
                style={{
                  ...ITEM_BASE,
                  ...INACTIVE_STYLE,
                  color: "#94a3b8",
                  opacity: 0.6,
                }}
                aria-disabled="true"
              >
                <span
                  className="material-icons"
                  aria-hidden="true"
                  style={{ fontSize: "20px" }}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
