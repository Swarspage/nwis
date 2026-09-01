/**
 * Features — M0.4 Feature Engineering View.
 *
 * Visual hierarchy:
 *   1. Hero: current parameter values as a styled panel (not a plain card)
 *   2. FeaturePanel (existing) for derived fields
 *
 * Light restyle to match M1.2 panel aesthetic.
 */
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import FeaturePanel from "../components/dashboard/FeaturePanel.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, formatValue, latest, measurementRows } from "../utils/format.js";

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

export default function Features() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const isLive = simulationState?.mode === "LIVE_SIMULATION" && simulationState?.status === "PLAYING";
  const pollMs = isLive ? 2000 : 0;
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

  const telemetry = useApiResource(
    () => api.telemetry(ts ? { timestamp: ts, limit: 51 } : { limit: 51 }, selectedWell),
    [ts, selectedWell],
    pollMs
  );

  if (telemetry.state === "loading") return <LoadingState lines={5} />;
  if (telemetry.state === "error") return <ErrorState error={telemetry.error} />;

  const current = latest(telemetry.data?.records || []);

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
          M0.4 Feature Engineering · {selectedWell}
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-heading-md)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--color-ink)",
            marginTop: 4,
          }}
        >
          Features
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            color: "var(--color-body)",
            marginTop: "var(--space-xs)",
          }}
        >
          Raw current values and derived feature fields. The FastAPI app does not expose a distinct /features
          route — this page uses M0.4-derived fields from /telemetry.
        </div>
      </div>

      <Panel
        label="Raw Telemetry Values"
        headerRight={
          <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
            {formatTimestamp(current?.timestamp)}
          </span>
        }
      >
        <DataTable
          rows={measurementRows(current)}
          columns={[
            { key: "name", header: "Parameter" },
            { key: "value", header: "Current value", render: (row) => formatValue(row.value) },
            { key: "quality", header: "Status" },
          ]}
          empty="No telemetry values returned."
        />
      </Panel>

      <FeaturePanel record={current} />
    </div>
  );
}
