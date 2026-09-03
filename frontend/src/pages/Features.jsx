/**
 * Features — M0.4 Feature Engineering View.
 *
 * Visual hierarchy:
 *   1. Data Quality Section — per-channel quality from measurements
 *   2. Raw Telemetry Values table (with quality column)
 *   3. FeaturePanel — derived signal features
 *
 * Cross-panel: clicking a feature channel sets focusContext.signal
 * so Telemetry and Intelligence pages respond.
 *
 * Note: /wells/{id}/features endpoint exists in client.js — this page
 * uses M0.4-derived fields from /telemetry as the source of truth.
 */
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import { useFocusContext, useFocusKeyHandler, FocusBanner, FOCUS_TYPES } from "../components/ui/FocusContext.jsx";
import FeaturePanel from "../components/dashboard/FeaturePanel.jsx";
import Panel from "../components/ui/Panel.jsx";
import DataQualityBadge from "../components/ui/DataQualityBadge.jsx";
import LiveBadge from "../components/ui/LiveBadge.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, formatUnit, formatValue, latest, measurementRows } from "../utils/format.js";

// Canonical measurement channels — checked against API payload
const CANONICAL_CHANNELS = [
  { key: "depth",              label: "Depth",              unit: "ft" },
  { key: "standpipe_pressure", label: "Standpipe Pressure", unit: "psi" },
  { key: "flow_rate",          label: "Flow Rate",          unit: "gpm" },
  { key: "hookload",           label: "Hookload",           unit: "klbs" },
  { key: "torque",             label: "Torque",             unit: "kft-lb" },
  { key: "rop",                label: "ROP",                unit: "ft/hr" },
  { key: "wob",                label: "WOB",                unit: "klbs" },
  { key: "rpm",                label: "RPM",                unit: "rpm" },
  { key: "block_position",     label: "Block Position",     unit: "ft" },
];

export default function Features() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const { focus, isFocused, clearFocus } = useFocusContext();
  useFocusKeyHandler();

  const isLive =
    simulationState?.mode === "LIVE_SIMULATION" &&
    simulationState?.status === "PLAYING";
  const isSynthetic = selectedWell !== "WELL-1";
  const pollMs = isLive ? 2000 : 0;
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

  const telemetry = useApiResource(
    () =>
      api.telemetry(
        ts ? { timestamp: ts, limit: 51 } : { limit: 51 },
        selectedWell
      ),
    [ts, selectedWell],
    pollMs
  );

  if (telemetry.state === "loading") return <LoadingState lines={5} />;
  if (telemetry.state === "error") return <ErrorState error={telemetry.error} />;

  const current = latest(telemetry.data?.records || []);
  const measurements = current?.measurements || {};

  // Build quality matrix from canonical channels
  const qualityChannels = CANONICAL_CHANNELS.map((ch) => {
    const m = measurements[ch.key];
    const value = m?.value ?? null;
    const status = !m ? "unavailable" : value == null ? "missing" : "available";
    return { ...ch, value, status, rawUnit: m?.unit };
  });

  const availableCount = qualityChannels.filter((c) => c.status === "available").length;
  const missingCount   = qualityChannels.filter((c) => c.status === "missing").length;
  const unavailableCount = qualityChannels.filter((c) => c.status === "unavailable").length;

  const rows = measurementRows(current);

  return (
    <div className="page">
      {/* Page header */}
      <div style={{ marginBottom: "var(--space-sm)" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          M0.4 Feature Engineering · {selectedWell}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap", marginTop: 4 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-xl)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)", margin: 0, letterSpacing: "var(--tracking-display-xl)" }}>
            Features
          </h1>
          {isLive && <LiveBadge />}
          {isSynthetic && !isLive && <DataQualityBadge status="synthetic" />}
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-md)", color: "var(--color-body)", margin: "var(--space-xs) 0 0", lineHeight: "var(--leading-body-md)" }}>
          Raw current values and derived feature fields from M0.4.
          The FastAPI app does not expose a distinct /features route —
          this page uses M0.4-derived fields from /telemetry.
        </p>
      </div>

      <FocusBanner />

      {/* Data Quality Matrix */}
      <Panel
        label="Data Quality"
        title="Channel Status"
        headerRight={
          <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
            <DataQualityBadge status="available"   label={`${availableCount} Available`} />
            {missingCount > 0    && <DataQualityBadge status="missing"     label={`${missingCount} Missing`} />}
            {unavailableCount > 0 && <DataQualityBadge status="unavailable" label={`${unavailableCount} Unavailable`} />}
          </div>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--space-sm)" }}>
          {qualityChannels.map((ch) => {
            const focused = isFocused(FOCUS_TYPES.SIGNAL, ch.key);
            return (
              <div
                key={ch.key}
                onClick={() => focused ? clearFocus() : focus(FOCUS_TYPES.SIGNAL, ch.key, ch.label)}
                className="card-interactive"
                style={{
                  background: focused ? "var(--color-signal-teal-soft)" : "var(--color-surface-sunken)",
                  border: `1px solid ${focused ? "var(--color-signal-teal)" : ch.status === "available" ? "var(--color-hairline)" : ch.status === "missing" ? "var(--color-brass)" : "var(--color-hairline-strong)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-slate)" }}>
                    {ch.label}
                  </span>
                  <DataQualityBadge status={ch.status} />
                </div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-md)", color: ch.value != null ? "var(--color-ink)" : "var(--color-mute)", fontStyle: ch.value == null ? "italic" : "normal" }}>
                  {ch.value != null
                    ? `${typeof ch.value === "number" ? ch.value.toFixed(1) : ch.value} ${ch.rawUnit || ch.unit}`
                    : "Unavailable"}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Raw Telemetry Values */}
      <Panel
        label="Raw Telemetry Values"
        headerRight={
          <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
            {formatTimestamp(current?.timestamp)}
          </span>
        }
      >
        <DataTable
          rows={rows}
          columns={[
            { key: "name",    header: "Parameter" },
            { key: "value",   header: "Value",   render: (row) => formatValue(row.value) },
            { key: "unit",    header: "Unit",    render: (row) => formatUnit(row.unit) },
            { key: "quality", header: "Quality" },
            { key: "source",  header: "Source" },
          ]}
          empty="No telemetry values returned."
        />
      </Panel>

      {/* Derived Features */}
      <FeaturePanel record={current} />
    </div>
  );
}
