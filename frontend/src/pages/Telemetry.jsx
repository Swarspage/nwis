/**
 * Telemetry — M0.4 multi-channel trace view.
 *
 * Visual hierarchy:
 *   1. Hero: 4-channel ECharts telemetry chart (400px)
 *   2. Current values table
 *
 * Live polling follows global simulation state.
 */
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import TelemetryChart from "../components/charts/TelemetryChart.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, formatUnit, formatValue, latest, measurementRows } from "../utils/format.js";

const FIELDS = [
  { key: "standpipe_pressure", label: "Standpipe Pressure" },
  { key: "flow_rate", label: "Flow Rate" },
  { key: "hookload", label: "Hookload" },
  { key: "torque", label: "Torque" },
];

function Panel({ label, children, headerRight }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-hairline)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
      }}
    >
      {(label || headerRight) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-md)",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
          }}
        >
          {label && (
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-label-sm)",
                fontWeight: "var(--weight-medium)",
                color: "var(--color-mute)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {label}
            </div>
          )}
          {headerRight}
        </div>
      )}
      {children}
    </div>
  );
}

export default function Telemetry() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const isLive = simulationState?.mode === "LIVE_SIMULATION" && simulationState?.status === "PLAYING";
  const pollMs = isLive ? 2000 : 0;
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

  const telemetry = useApiResource(
    () => api.telemetry(ts ? { timestamp: ts, limit: 120 } : { limit: 120 }, selectedWell),
    [ts, selectedWell],
    pollMs
  );

  if (telemetry.state === "loading") return <LoadingState lines={5} />;
  if (telemetry.state === "error") return <ErrorState error={telemetry.error} />;

  const records = telemetry.data?.records || [];
  const current = latest(records);
  const rows = measurementRows(current);

  return (
    <div className="page">
      {/* Page header */}
      <div style={{ marginBottom: "var(--space-md)" }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-label-sm)",
            color: "var(--color-mute)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          M0.4 API Payload · {selectedWell}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-md)",
            flexWrap: "wrap",
            marginTop: 4,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-heading-md)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-ink)",
            }}
          >
            Telemetry
          </div>
          {isLive && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "var(--color-signal-teal-soft)",
                color: "var(--color-signal-teal)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-label-sm)",
                fontWeight: "var(--weight-medium)",
                padding: "3px 10px",
                borderRadius: "var(--radius-pill)",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-signal-teal)",
                  animation: "livePulse 1.8s ease-in-out infinite",
                }}
              />
              Streaming
            </div>
          )}
        </div>
      </div>

      {/* Hero: 4-channel chart */}
      <Panel
        label="Multi-Channel Trace"
        headerRight={
          <span
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-data-sm)",
              color: "var(--color-mute)",
            }}
          >
            {records.length} records · {formatTimestamp(current?.timestamp)}
          </span>
        }
      >
        <TelemetryChart records={records} fields={FIELDS} height={380} />
      </Panel>

      {/* Current values table */}
      <Panel label="Current Values">
        <div
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-data-sm)",
            color: "var(--color-mute)",
            marginBottom: "var(--space-md)",
          }}
        >
          Telemetry status: {current?.telemetry_status || "—"} · {formatTimestamp(current?.timestamp)}
        </div>
        <DataTable
          rows={rows}
          columns={[
            { key: "name", header: "Parameter" },
            { key: "value", header: "Value", render: (row) => formatValue(row.value) },
            { key: "unit", header: "Unit", render: (row) => formatUnit(row.unit) },
            { key: "quality", header: "Quality" },
            { key: "source", header: "Source" },
          ]}
          empty="No telemetry values returned."
        />
      </Panel>
    </div>
  );
}
