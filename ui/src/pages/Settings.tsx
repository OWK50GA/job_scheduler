import { useState } from "react";

// ─── Palette ─────────────────────────────────────────────────────────────────
const surface = "#051424";
const surfaceContainer = "#0f172a";
const surfaceHigh = "#1e293b";
const onSurface = "#f8fafc";
const onSurfaceVariant = "#94a3b8";
const outline = "#475569";
const primary = "#0ea5e9";
const secondary = "#10b981";

// ─── Dummy Data: system configuration defaults ────────────────────────────────
const DUMMY_MASTER_API_KEY = "sk-prod-xK9mL2nP4qR7sT1uV3wX5yZ8aB0cD6eF"; // DUMMY DATA

// ─── Webhook row type ─────────────────────────────────────────────────────────
interface WebhookRow {
  id: string;
  serviceName: string;
  endpointUrl: string;
  events: string;
  status: "ACTIVE" | "INACTIVE";
  isNew?: boolean;
}

// ─── Dummy Data: initial webhook rows ─────────────────────────────────────────
const DUMMY_WEBHOOK_ROWS: WebhookRow[] = [
  // DUMMY DATA
  {
    id: "wh-001",
    serviceName: "PagerDuty",
    endpointUrl: "https://events.pagerduty.com/v2/enqueue",
    events: "FAILED",
    status: "ACTIVE",
  },
  {
    id: "wh-002",
    serviceName: "Slack Ops",
    endpointUrl: "https://hooks.slack.com/services/T00/B00/xxxx",
    events: "ALL",
    status: "ACTIVE",
  },
  {
    id: "wh-003",
    serviceName: "DataDog",
    endpointUrl: "https://api.datadoghq.com/api/v1/events",
    events: "COMPLETED",
    status: "INACTIVE",
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  backgroundColor: surface,
  minHeight: "100vh",
  color: onSurface,
  fontFamily:
    "'Geist', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  padding: "1.5rem",
};

const sectionCardStyle: React.CSSProperties = {
  backgroundColor: surfaceContainer,
  borderRadius: "0.5rem",
  padding: "1.5rem",
  marginBottom: "1.5rem",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: onSurfaceVariant,
  marginBottom: "1.25rem",
  paddingBottom: "0.75rem",
  borderBottom: `1px solid ${surfaceHigh}`,
};

const fieldRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  alignItems: "center",
  gap: "1rem",
  marginBottom: "1rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: onSurfaceVariant,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: surfaceHigh,
  color: onSurface,
  border: `1px solid ${outline}`,
  borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

// ─── Toggle Switch component ──────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  id: string;
}

function ToggleSwitch({ checked, onChange, id }: ToggleSwitchProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: "44px",
        height: "24px",
        borderRadius: "9999px",
        border: "none",
        cursor: "pointer",
        transition: "background-color 0.2s",
        backgroundColor: checked ? primary : outline,
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: checked ? "22px" : "2px",
          width: "20px",
          height: "20px",
          borderRadius: "9999px",
          backgroundColor: "#ffffff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Settings() {
  // ── System Configuration state ────────────────────────────────────────────
  const [masterApiKey, setMasterApiKey] = useState(DUMMY_MASTER_API_KEY); // DUMMY DATA
  const [environmentTag, setEnvironmentTag] = useState("production-west-01");
  const [maxRetryAttempts, setMaxRetryAttempts] = useState(3);
  const [tcpTimeoutMs, setTcpTimeoutMs] = useState(5000);
  const [sslVerification, setSslVerification] = useState(true);

  // ── Display section state ─────────────────────────────────────────────────
  const [monochromeMode, setMonochromeMode] = useState(false);
  const [liveLogStream, setLiveLogStream] = useState(false);
  const [highDensityGrid, setHighDensityGrid] = useState(false);
  const [fontStack, setFontStack] = useState<
    "JetBrains Mono" | "Fira Code" | "IBM Plex Mono"
  >("JetBrains Mono");

  // ── Notification Webhooks state ───────────────────────────────────────────
  const [webhookRows, setWebhookRows] =
    useState<WebhookRow[]>(DUMMY_WEBHOOK_ROWS); // DUMMY DATA

  function handleDeleteWebhook(id: string) {
    setWebhookRows((prev) => prev.filter((row) => row.id !== id));
  }

  function handleRegisterEndpoint() {
    const newRow: WebhookRow = {
      id: crypto.randomUUID(),
      serviceName: "",
      endpointUrl: "",
      events: "ALL",
      status: "ACTIVE",
      isNew: true,
    };
    setWebhookRows((prev) => [...prev, newRow]);
  }

  function handleWebhookFieldChange(
    id: string,
    field: "serviceName" | "endpointUrl",
    value: string,
  ) {
    setWebhookRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <div style={pageStyle}>
      {/* ── Page heading ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: onSurface,
            margin: 0,
          }}
        >
          Settings
        </h1>
        <p
          style={{
            fontSize: "0.8rem",
            color: onSurfaceVariant,
            margin: "0.25rem 0 0",
          }}
        >
          System configuration and preferences
        </p>
      </div>

      {/* ── System Configuration section ── */}
      <div style={sectionCardStyle}>
        <p style={sectionTitleStyle}>System Configuration</p>

        {/* MASTER_API_KEY */}
        <div style={fieldRowStyle}>
          <label htmlFor="master-api-key" style={labelStyle}>
            Master API Key
          </label>
          <input
            id="master-api-key"
            type="password"
            value={masterApiKey}
            onChange={(e) => setMasterApiKey(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
            spellCheck={false}
          />
        </div>

        {/* ENVIRONMENT_TAG */}
        <div style={fieldRowStyle}>
          <label htmlFor="environment-tag" style={labelStyle}>
            Environment Tag
          </label>
          <select
            id="environment-tag"
            value={environmentTag}
            onChange={(e) => setEnvironmentTag(e.target.value)}
            style={selectStyle}
          >
            <option value="production-west-01">production-west-01</option>
            <option value="staging-cluster">staging-cluster</option>
            <option value="dev-sandbox">dev-sandbox</option>
          </select>
        </div>

        {/* MAX_RETRY_ATTEMPTS */}
        <div style={fieldRowStyle}>
          <label htmlFor="max-retry-attempts" style={labelStyle}>
            Max Retry Attempts
          </label>
          <input
            id="max-retry-attempts"
            type="number"
            min={0}
            step={1}
            value={maxRetryAttempts}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 0) setMaxRetryAttempts(val);
            }}
            style={{ ...inputStyle, maxWidth: "160px" }}
          />
        </div>

        {/* TCP_TIMEOUT_MS */}
        <div style={fieldRowStyle}>
          <label htmlFor="tcp-timeout-ms" style={labelStyle}>
            TCP Timeout (ms)
          </label>
          <input
            id="tcp-timeout-ms"
            type="number"
            min={0}
            step={1}
            value={tcpTimeoutMs}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 0) setTcpTimeoutMs(val);
            }}
            style={{ ...inputStyle, maxWidth: "160px" }}
          />
        </div>

        {/* SSL Verification */}
        <div style={{ ...fieldRowStyle, marginBottom: "1.5rem" }}>
          <label htmlFor="ssl-verification" style={labelStyle}>
            SSL Verification
          </label>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <ToggleSwitch
              id="ssl-verification"
              checked={sslVerification}
              onChange={setSslVerification}
            />
            <span
              style={{
                fontSize: "0.8rem",
                color: sslVerification ? primary : onSurfaceVariant,
              }}
            >
              {sslVerification ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: `1px solid ${surfaceHigh}`,
            marginBottom: "1.25rem",
          }}
        />

        {/* Save Changes button — non-functional placeholder */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => {
              /* no-op — non-functional placeholder */
            }}
            style={{
              padding: "0.5rem 1.5rem",
              backgroundColor: primary,
              color: "#ffffff",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.025em",
            }}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* ── Display section ── */}
      <div style={sectionCardStyle}>
        <p style={sectionTitleStyle}>Display</p>

        {/* Monochrome Mode */}
        <div style={{ ...fieldRowStyle, marginBottom: "1rem" }}>
          <label htmlFor="monochrome-mode" style={labelStyle}>
            Monochrome Mode
          </label>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <ToggleSwitch
              id="monochrome-mode"
              checked={monochromeMode}
              onChange={setMonochromeMode}
            />
            <span
              style={{
                fontSize: "0.8rem",
                color: monochromeMode ? primary : onSurfaceVariant,
              }}
            >
              {monochromeMode ? "On" : "Off"}
            </span>
          </div>
        </div>

        {/* Live Log Stream */}
        <div style={{ ...fieldRowStyle, marginBottom: "1rem" }}>
          <label htmlFor="live-log-stream" style={labelStyle}>
            Live Log Stream
          </label>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <ToggleSwitch
              id="live-log-stream"
              checked={liveLogStream}
              onChange={setLiveLogStream}
            />
            <span
              style={{
                fontSize: "0.8rem",
                color: liveLogStream ? primary : onSurfaceVariant,
              }}
            >
              {liveLogStream ? "On" : "Off"}
            </span>
          </div>
        </div>

        {/* High Density Grid */}
        <div style={{ ...fieldRowStyle, marginBottom: "1rem" }}>
          <label htmlFor="high-density-grid" style={labelStyle}>
            High Density Grid
          </label>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <ToggleSwitch
              id="high-density-grid"
              checked={highDensityGrid}
              onChange={setHighDensityGrid}
            />
            <span
              style={{
                fontSize: "0.8rem",
                color: highDensityGrid ? primary : onSurfaceVariant,
              }}
            >
              {highDensityGrid ? "On" : "Off"}
            </span>
          </div>
        </div>

        {/* System Font Stack */}
        <div style={{ ...fieldRowStyle, marginBottom: "1.5rem" }}>
          <label htmlFor="system-font-stack" style={labelStyle}>
            System Font Stack
          </label>
          <select
            id="system-font-stack"
            value={fontStack}
            onChange={(e) => setFontStack(e.target.value as typeof fontStack)}
            style={{ ...selectStyle, maxWidth: "240px" }}
          >
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Fira Code">Fira Code</option>
            <option value="IBM Plex Mono">IBM Plex Mono</option>
          </select>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: `1px solid ${surfaceHigh}`,
            marginBottom: "1.25rem",
          }}
        />

        {/* Reset UI button */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => {
              setMonochromeMode(false);
              setLiveLogStream(false);
              setHighDensityGrid(false);
            }}
            style={{
              padding: "0.5rem 1.25rem",
              backgroundColor: "transparent",
              color: onSurfaceVariant,
              border: `1px solid ${outline}`,
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.025em",
            }}
          >
            Reset UI
          </button>
        </div>
      </div>

      {/* ── Notification Webhooks section ── */}
      <div style={sectionCardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
            paddingBottom: "0.75rem",
            borderBottom: `1px solid ${surfaceHigh}`,
          }}
        >
          <p
            style={{
              ...sectionTitleStyle,
              marginBottom: 0,
              paddingBottom: 0,
              borderBottom: "none",
            }}
          >
            Notification Webhooks
          </p>
          <button
            onClick={handleRegisterEndpoint}
            style={{
              padding: "0.4rem 1rem",
              backgroundColor: primary,
              color: "#ffffff",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.025em",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span
              className="material-icons"
              style={{ fontSize: "0.95rem", lineHeight: 1 }}
            >
              add
            </span>
            Register Endpoint
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.8rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${surfaceHigh}` }}>
                {(
                  [
                    "SERVICE_NAME",
                    "ENDPOINT_URL",
                    "EVENTS",
                    "STATUS",
                    "ACTION",
                  ] as const
                ).map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: col === "ACTION" ? "center" : "left",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: onSurfaceVariant,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {webhookRows.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: `1px solid ${surfaceHigh}` }}
                >
                  {/* SERVICE_NAME */}
                  <td style={{ padding: "0.6rem 0.75rem", color: onSurface }}>
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.serviceName}
                        onChange={(e) =>
                          handleWebhookFieldChange(
                            row.id,
                            "serviceName",
                            e.target.value,
                          )
                        }
                        placeholder="Service name"
                        style={{
                          ...inputStyle,
                          maxWidth: "160px",
                          padding: "0.3rem 0.5rem",
                          fontSize: "0.8rem",
                        }}
                      />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{row.serviceName}</span>
                    )}
                  </td>

                  {/* ENDPOINT_URL */}
                  <td
                    style={{
                      padding: "0.6rem 0.75rem",
                      color: onSurfaceVariant,
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                    }}
                  >
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.endpointUrl}
                        onChange={(e) =>
                          handleWebhookFieldChange(
                            row.id,
                            "endpointUrl",
                            e.target.value,
                          )
                        }
                        placeholder="https://..."
                        style={{
                          ...inputStyle,
                          minWidth: "260px",
                          padding: "0.3rem 0.5rem",
                          fontSize: "0.8rem",
                        }}
                      />
                    ) : (
                      row.endpointUrl
                    )}
                  </td>

                  {/* EVENTS */}
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.55rem",
                        borderRadius: "9999px",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        backgroundColor: surfaceHigh,
                        color: onSurfaceVariant,
                        border: `1px solid ${outline}`,
                      }}
                    >
                      {row.events}
                    </span>
                  </td>

                  {/* STATUS */}
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.55rem",
                        borderRadius: "9999px",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        backgroundColor:
                          row.status === "ACTIVE" ? secondary : outline,
                        color: "#ffffff",
                      }}
                    >
                      {row.status}
                    </span>
                  </td>

                  {/* ACTION */}
                  <td
                    style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}
                  >
                    <button
                      aria-label={`Delete ${row.serviceName || "webhook"} endpoint`}
                      onClick={() => handleDeleteWebhook(row.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: "0.25rem",
                        borderRadius: "0.25rem",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: onSurfaceVariant,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "#ef4444";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color =
                          onSurfaceVariant;
                      }}
                    >
                      <span
                        className="material-icons"
                        style={{ fontSize: "1.1rem" }}
                      >
                        delete
                      </span>
                    </button>
                  </td>
                </tr>
              ))}

              {webhookRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: onSurfaceVariant,
                      fontSize: "0.8rem",
                    }}
                  >
                    No webhook endpoints configured. Click "Register Endpoint"
                    to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
