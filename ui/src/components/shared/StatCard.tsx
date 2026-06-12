interface StatCardProps {
  label: string;
  value: string | number;
  accentColor?: string;
  delta?: string;
  icon?: string;
}

export function StatCard({
  label,
  value,
  accentColor,
  delta,
  icon,
}: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#0f172a",
        borderLeft: accentColor ? `4px solid ${accentColor}` : undefined,
        borderRadius: "0.5rem",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        {icon && (
          <span
            className="material-icons"
            style={{ fontSize: "1.25rem", color: accentColor ?? "#94a3b8" }}
          >
            {icon}
          </span>
        )}
        <span
          style={{
            fontSize: "0.75rem",
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          color: "#f8fafc",
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      {delta && (
        <span
          style={{
            fontSize: "0.8rem",
            color: "#94a3b8",
          }}
        >
          {delta}
        </span>
      )}
    </div>
  );
}
