import { useState } from "react";
import { Button } from "../components/shared/Button";
import { MockBadge } from "../components/shared/MockBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { Panel } from "../components/shared/Panel";

const DUMMY_MASTER_API_KEY = "sk-live-550e8400-e29b-41d4-a716-446655440000"; // DUMMY DATA

interface WebhookRow {
  id: string;
  serviceName: string;
  endpointUrl: string;
  events: string;
  status: "ACTIVE" | "INACTIVE";
  isNew?: boolean;
}

const DUMMY_WEBHOOK_ROWS: WebhookRow[] = [
  {
    id: "wh-001",
    serviceName: "slack-incident-bridge",
    endpointUrl: "https://hooks.slack.com/services/T000/B000/XXXX",
    events: "incident.critical",
    status: "ACTIVE",
  },
  {
    id: "wh-002",
    serviceName: "pagerduty-prod",
    endpointUrl: "https://events.pagerduty.com/v2/enqueue",
    events: "system.warning",
    status: "ACTIVE",
  },
]; // DUMMY DATA

function ToggleSwitch({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-primary" : "bg-surface-container-highest"}`.trim()}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0.5"}`.trim()}
      ></span>
    </button>
  );
}

const inputClassName =
  "w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 font-code text-[13px] text-on-surface outline-none transition focus:border-primary";

export default function Settings() {
  const [masterApiKey, setMasterApiKey] = useState(DUMMY_MASTER_API_KEY);
  const [environmentTag, setEnvironmentTag] = useState("production-west-01");
  const [maxRetryAttempts, setMaxRetryAttempts] = useState(5);
  const [tcpTimeoutMs, setTcpTimeoutMs] = useState(30000);
  const [sslVerification, setSslVerification] = useState(true);
  const [monochromeMode, setMonochromeMode] = useState(false);
  const [liveLogStream, setLiveLogStream] = useState(true);
  const [highDensityGrid, setHighDensityGrid] = useState(true);
  const [fontStack, setFontStack] = useState<
    "JetBrains Mono" | "Fira Code" | "IBM Plex Mono"
  >("JetBrains Mono");
  const [webhookRows, setWebhookRows] =
    useState<WebhookRow[]>(DUMMY_WEBHOOK_ROWS);

  function handleDeleteWebhook(id: string) {
    setWebhookRows((previous) => previous.filter((row) => row.id !== id));
  }

  function handleRegisterEndpoint() {
    setWebhookRows((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        serviceName: "",
        endpointUrl: "",
        events: "ALL",
        status: "ACTIVE",
        isNew: true,
      },
    ]);
  }

  function handleWebhookFieldChange(
    id: string,
    field: "serviceName" | "endpointUrl",
    value: string,
  ) {
    setWebhookRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Engine Configuration"
        description="Manage system parameters, display preferences, and notification endpoints in the Stitch-aligned settings console."
        badges={
          <>
            <MockBadge label="Dummy Config" />
            <MockBadge label="Local UI State" tone="info" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
            <div className="space-y-1">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                System Configuration
              </h2>
              <p className="font-body text-sm text-on-surface-variant">
                Technical inputs remain dummy for now, but the layout matches
                the intended control surface.
              </p>
            </div>
            <MockBadge label="Dummy Data" />
          </div>
          <div className="grid grid-cols-1 gap-5 px-4 py-5 md:grid-cols-2 sm:px-5">
            <div className="space-y-2">
              <label className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                MASTER_API_KEY
              </label>
              <input
                type="password"
                className={inputClassName}
                value={masterApiKey}
                onChange={(event) => setMasterApiKey(event.target.value)}
              />
              <p className="font-code text-[11px] text-on-surface-variant">
                Rotation recommended every 90 days.
              </p>
            </div>
            <div className="space-y-2">
              <label className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                ENVIRONMENT_TAG
              </label>
              <select
                className={inputClassName}
                value={environmentTag}
                onChange={(event) => setEnvironmentTag(event.target.value)}
              >
                <option value="production-west-01">production-west-01</option>
                <option value="staging-cluster">staging-cluster</option>
                <option value="dev-sandbox">dev-sandbox</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                MAX_RETRY_ATTEMPTS
              </label>
              <input
                type="number"
                min={0}
                className={inputClassName}
                value={maxRetryAttempts}
                onChange={(event) =>
                  setMaxRetryAttempts(Number(event.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-2">
              <label className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                TCP_TIMEOUT_MS
              </label>
              <input
                type="number"
                min={0}
                className={inputClassName}
                value={tcpTimeoutMs}
                onChange={(event) =>
                  setTcpTimeoutMs(Number(event.target.value) || 0)
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 border-t border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-3">
              <ToggleSwitch
                id="ssl-verification"
                checked={sslVerification}
                onChange={setSslVerification}
              />
              <span className="font-body text-sm text-on-surface">
                Enable Strict SSL Verification
              </span>
            </div>
            <Button
              variant="secondary"
              className="border-on-surface bg-on-surface text-surface hover:bg-white/90"
            >
              Save Changes
            </Button>
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 sm:px-5">
            <h2 className="font-headline text-[20px] font-semibold text-on-surface">
              Display
            </h2>
            <MockBadge label="Local Toggles" tone="info" />
          </div>
          <div className="space-y-5 px-4 py-5 sm:px-5">
            {[
              {
                title: "Monochrome Mode",
                description: "Disable color signaling",
                checked: monochromeMode,
                onChange: setMonochromeMode,
                id: "monochrome-mode",
              },
              {
                title: "Live Log Stream",
                description: "Auto-scroll in Dashboard",
                checked: liveLogStream,
                onChange: setLiveLogStream,
                id: "live-log-stream",
              },
              {
                title: "High Density Grid",
                description: "Maximize row count",
                checked: highDensityGrid,
                onChange: setHighDensityGrid,
                id: "high-density-grid",
              },
            ].map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-body text-sm font-medium text-on-surface">
                    {item.title}
                  </p>
                  <p className="font-body text-xs text-on-surface-variant">
                    {item.description}
                  </p>
                </div>
                <ToggleSwitch
                  id={item.id}
                  checked={item.checked}
                  onChange={item.onChange}
                />
              </div>
            ))}

            <div className="space-y-2 border-t border-outline-variant pt-4">
              <label className="font-body text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                SYSTEM_FONT_STACK
              </label>
              <select
                className={inputClassName}
                value={fontStack}
                onChange={(event) =>
                  setFontStack(event.target.value as typeof fontStack)
                }
              >
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Fira Code">Fira Code</option>
                <option value="IBM Plex Mono">IBM Plex Mono</option>
              </select>
            </div>

            <div className="flex justify-end border-t border-outline-variant pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setMonochromeMode(false);
                  setLiveLogStream(true);
                  setHighDensityGrid(true);
                }}
              >
                Reset UI
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-headline text-[20px] font-semibold text-on-surface">
                Notification Webhooks
              </h2>
              <MockBadge label="Dummy Rows" />
            </div>
            <p className="font-body text-sm text-on-surface-variant">
              Manage placeholder outbound integrations before backend settings
              wiring begins.
            </p>
          </div>
          <Button icon="add" variant="link" onClick={handleRegisterEndpoint}>
            Register Endpoint
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="app-table min-w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3">Service Name</th>
                <th className="px-4 py-3">Endpoint URL</th>
                <th className="px-4 py-3">Events</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {webhookRows.map((row) => (
                <tr
                  key={row.id}
                  className="transition hover:bg-surface-container-highest/20"
                >
                  <td className="px-4 py-3">
                    {row.isNew ? (
                      <input
                        type="text"
                        className={inputClassName}
                        value={row.serviceName}
                        onChange={(event) =>
                          handleWebhookFieldChange(
                            row.id,
                            "serviceName",
                            event.target.value,
                          )
                        }
                        placeholder="Service name"
                      />
                    ) : (
                      <span className="font-body text-sm font-medium text-on-surface">
                        {row.serviceName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-code text-[12px] text-on-surface-variant">
                    {row.isNew ? (
                      <input
                        type="text"
                        className={inputClassName}
                        value={row.endpointUrl}
                        onChange={(event) =>
                          handleWebhookFieldChange(
                            row.id,
                            "endpointUrl",
                            event.target.value,
                          )
                        }
                        placeholder="https://..."
                      />
                    ) : (
                      row.endpointUrl
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-sm border border-outline bg-surface-container-high px-2 py-1 font-code text-[10px] font-semibold uppercase tracking-technical text-on-surface-variant">
                      {row.events}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-sm px-2 py-1 font-code text-[10px] font-semibold uppercase tracking-technical ${row.status === "ACTIVE" ? "bg-secondary/10 text-secondary" : "bg-surface-container-high text-on-surface-variant"}`.trim()}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded border border-error/40 bg-error/10 p-1.5 text-error transition hover:bg-error/20"
                      onClick={() => handleDeleteWebhook(row.id)}
                      aria-label={`Delete ${row.serviceName || "webhook"}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </td>
                </tr>
              ))}

              {webhookRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center font-body text-sm text-on-surface-variant"
                  >
                    No webhook endpoints configured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
