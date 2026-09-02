/**
 * Telemetry — Live Well Monitoring Console.
 *
 * Visual hierarchy:
 *   1. Page header: "Live Well Monitoring" + mode badges
 *   2. Metric matrix: MetricCards for all available channels
 *   3. Primary multi-channel ECharts trace with parameter toggle
 *   4. Current values table with quality column
 *
 * Cross-panel: clicking a metric card sets focusContext to that signal.
 * Other pages (Intelligence) will highlight the corresponding evidence.
 *
 * Live polling follows global simulation state.
 * Depth shows "Unavailable" when null — never fabricated.
 */
import { useState, useMemo } from "react";
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import { useFocusContext, useFocusKeyHandler, FocusBanner, FOCUS_TYPES } from "../components/ui/FocusContext.jsx";
import TelemetryChart from "../components/charts/TelemetryChart.jsx";
import Panel from "../components/ui/Panel.jsx";
import MetricCard from "../components/ui/MetricCard.jsx";
import LiveBadge from "../components/ui/LiveBadge.jsx";
import DataQualityBadge from "../components/ui/DataQualityBadge.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, formatValue, formatUnit, latest, measurementRows } from "../utils/format.js";

// All tracked telemetry channels — shown as metric cards if data present
const ALL_CHANNELS = [
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

// Default chart overlay (subset for readability)
const DEFAULT_CHART_FIELDS = [
  { key: "standpipe_pressure", label: "Standpipe Pressure" },
  { key: "flow_rate",          label: "Flow Rate" },
  { key: "hookload",           label: "Hookload" },
  { key: "torque",             label: "Torque" },
];

export default function Telemetry() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const { focus, isFocused, focusContext, clearFocus } = useFocusContext();
  useFocusKeyHandler();

  const isLive =
    simulationState?.mode === "LIVE_SIMULATION" &&
    simulationState?.status === "PLAYING";
  const isSynthetic = selectedWell !== "WELL-1";
  const pollMs = isLive ? 2000 : 0;
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

  // Active chart parameter selection
  const [activeChartKeys, setActiveChartKeys] = useState(
    new Set(DEFAULT_CHART_FIELDS.map((f) => f.key))
  );

  const telemetry = useApiResource(
    () =>
      api.telemetry(
        ts ? { timestamp: ts, limit: 120 } : { limit: 120 },
        selectedWell
      ),
    [ts, selectedWell],
    pollMs
  );

  if (telemetry.state === "loading") return <LoadingState lines={5} />;
  if (telemetry.state === "error") return <ErrorState error={telemetry.error} />;

  const records = telemetry.data?.records || [];
  const current = latest(records);
  const rows = measurementRows(current);

  // Build metric cards from canonical measurements path
  const metricChannels = ALL_CHANNELS.map((ch) => {
    const m = current?.measurements?.[ch.key];
    const value = m?.value ?? null;
    const quality = m
      ? value != null
        ? "available"
        : "missing"
      : "unavailable";
    return { ...ch, value, quality, measurement: m };
  });

  // Active chart fields — only those with any data in the records
  const activeChartFields = ALL_CHANNELS.filter(
    (ch) =>
      activeChartKeys.has(ch.key) &&
      records.some(
        (r) =>
          r.measurements?.[ch.key]?.value != null ||
          r.signal_features?.[ch.key]?.current_value != null
      )
  );

  const toggleChannel = (key) => {
    setActiveChartKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least 1
      } else {
        if (next.size < 6) next.add(key); // max 6 for legibility
      }
      return next;
    });
  };

  return (
    <div className="page">
      {/* Page header */}
      <div style={{ marginBottom: "var(--space-sm)" }}>
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
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-display-xl)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-ink)",
              margin: 0,
              letterSpacing: "var(--tracking-display-xl)",
            }}
          >
            Live Well Monitoring
          </h1>
          {isLive && <LiveBadge label="Streaming" size="md" />}
          {isSynthetic && !isLive && (
            <DataQualityBadge status="synthetic" />
          )}
        </div>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-md)",
            color: "var(--color-body)",
            margin: "var(--space-xs) 0 0",
            lineHeight: "var(--leading-body-md)",
          }}
        >
          Current drilling telemetry and operational behaviour.{" "}
          {records.length} records · {formatTimestamp(current?.timestamp)}
        </p>
      </div>

      {/* Focus context banner */}
      <FocusBanner />

      {/* Metric matrix */}
      <Panel
        label="Current Values"
        headerRight={
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-mute)",
            }}
          >
            Click a channel to focus cross-panel
          </span>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "var(--space-sm)",
          }}
        >
          {metricChannels.map((ch) => {
            const focused = isFocused(FOCUS_TYPES.SIGNAL, ch.key);
            return (
              <MetricCard
                key={ch.key}
                label={ch.label}
                value={ch.value}
                unit={ch.unit}
                quality={ch.quality}
                focused={focused}
                onClick={() =>
                  focused
                    ? clearFocus()
                    : focus(FOCUS_TYPES.SIGNAL, ch.key, ch.label)
                }
              />
            );
          })}
        </div>
      </Panel>

      {/* Multi-channel chart with parameter toggle */}
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
            {records.length} records
          </span>
        }
      >
        {/* Parameter toggle */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
            marginBottom: "var(--space-md)",
          }}
        >
          {ALL_CHANNELS.filter((ch) =>
            records.some(
              (r) =>
                r.measurements?.[ch.key]?.value != null ||
                r.signal_features?.[ch.key]?.current_value != null
            )
          ).map((ch) => {
            const active = activeChartKeys.has(ch.key);
            const focused = isFocused(FOCUS_TYPES.SIGNAL, ch.key);
            return (
              <button
                key={ch.key}
                onClick={() => toggleChannel(ch.key)}
                style={{
                  background: active
                    ? focused
                      ? "var(--color-signal-teal)"
                      : "var(--color-ink)"
                    : "var(--color-canvas)",
                  color: active ? "#fff" : "var(--color-mute)",
                  border: `1px solid ${
                    focused
                      ? "var(--color-signal-teal)"
                      : active
                      ? "var(--color-ink)"
                      : "var(--color-hairline-strong)"
                  }`,
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 10px",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-label-sm)",
                  fontWeight: "var(--weight-medium)",
                  cursor: "pointer",
                  transition: "all var(--motion-fast) var(--ease-standard)",
                }}
              >
                {ch.label}
              </button>
            );
          })}
        </div>

        <TelemetryChart
          records={records}
          fields={
            activeChartFields.length > 0
              ? activeChartFields
              : DEFAULT_CHART_FIELDS
          }
          height={380}
        />
      </Panel>

      {/* Current values table */}
      <Panel
        label="Parameter Detail"
        headerRight={
          <span
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-data-sm)",
              color: "var(--color-mute)",
            }}
          >
            Status: {current?.telemetry_status || "—"} ·{" "}
            {formatTimestamp(current?.timestamp)}
          </span>
        }
      >
        <DataTable
          rows={rows}
          columns={[
            { key: "name", header: "Parameter" },
            {
              key: "value",
              header: "Value",
              render: (row) => formatValue(row.value),
            },
            {
              key: "unit",
              header: "Unit",
              render: (row) => formatUnit(row.unit),
            },
            { key: "quality", header: "Quality" },
            { key: "source", header: "Source" },
          ]}
          empty="No telemetry values returned by the API."
        />
      </Panel>
    </div>
  );
}
