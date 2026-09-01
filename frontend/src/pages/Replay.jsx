/**
 * Replay — Chronological timeline replay (WELL-1 historical).
 *
 * Visual hierarchy:
 *   1. Timeline scrubber + controls (matching SimulationControls aesthetic)
 *   2. Side-by-side: Risk gauge + RiskChart of history
 *   3. TelemetryChart from current snapshot
 *   4. Evidence (EvidenceSummary + ModelEvidence, collapsed below)
 *
 * Replay-specific: does not follow simulation clock — has its own index/speed state.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import RiskGauge from "../components/charts/RiskGauge.jsx";
import RiskChart from "../components/charts/RiskChart.jsx";
import TelemetryChart from "../components/charts/TelemetryChart.jsx";
import EvidenceSummary from "../components/dashboard/EvidenceSummary.jsx";
import ModelEvidence from "../components/dashboard/ModelEvidence.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, formatValue, measurementRows } from "../utils/format.js";
import DataTable from "../components/ui/DataTable.jsx";

const TELEMETRY_FIELDS = [
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

// ── Technical replay controls bar ───────────────────────────
function ReplayBar({ playing, onPlayPause, onStepBack, onStepForward, speed, onSpeedChange, index, total, timestamp }) {
  const SPEEDS = [300, 600, 900, 1800];

  return (
    <div
      style={{
        background: "var(--color-ink)",
        borderRadius: "var(--radius-lg)",
        padding: "12px var(--space-lg)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-md)",
        flexWrap: "wrap",
      }}
    >
      {/* Label */}
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label-sm)",
          fontWeight: "var(--weight-medium)",
          color: "rgba(234,240,238,0.45)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}
      >
        Replay
      </span>

      <div style={{ width: 1, height: 18, background: "rgba(234,240,238,0.12)" }} />

      {/* Step back */}
      <button
        onClick={onStepBack}
        style={{
          background: "rgba(234,240,238,0.08)",
          color: "rgba(234,240,238,0.6)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          padding: "5px 9px",
          cursor: "pointer",
          fontFamily: "var(--font-code)",
          fontSize: 13,
        }}
      >
        ‹
      </button>

      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: playing ? "var(--color-signal-teal)" : "rgba(234,240,238,0.1)",
          color: playing ? "#fff" : "rgba(234,240,238,0.8)",
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: "6px 14px",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-sm)",
          fontWeight: "var(--weight-medium)",
          cursor: "pointer",
          transition: "background 220ms",
        }}
      >
        {playing ? (
          <>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect x="1" y="1" width="3" height="8" rx="1" />
              <rect x="6" y="1" width="3" height="8" rx="1" />
            </svg>
            Pause
          </>
        ) : (
          <>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <polygon points="2,1 9,5 2,9" />
            </svg>
            Play
          </>
        )}
      </button>

      {/* Step forward */}
      <button
        onClick={onStepForward}
        style={{
          background: "rgba(234,240,238,0.08)",
          color: "rgba(234,240,238,0.6)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          padding: "5px 9px",
          cursor: "pointer",
          fontFamily: "var(--font-code)",
          fontSize: 13,
        }}
      >
        ›
      </button>

      <div style={{ width: 1, height: 18, background: "rgba(234,240,238,0.12)" }} />

      {/* Speed */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "rgba(234,240,238,0.35)", marginRight: 4 }}>
          Interval
        </span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            style={{
              background: speed === s ? "var(--color-signal-teal)" : "rgba(234,240,238,0.07)",
              color: speed === s ? "#fff" : "rgba(234,240,238,0.55)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "4px 9px",
              fontFamily: "var(--font-code)",
              fontSize: 11,
              cursor: "pointer",
              transition: "background 120ms, color 120ms",
            }}
          >
            {s}ms
          </button>
        ))}
      </div>

      {/* Progress + timestamp */}
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "rgba(234,240,238,0.35)" }}>
          {index + 1} / {total}
        </div>
        <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "rgba(234,240,238,0.55)", marginTop: 1 }}>
          {formatTimestamp(timestamp)}
        </div>
      </div>
    </div>
  );
}

// ── Minimal progress scrubber ────────────────────────────────
function ProgressScrubber({ index, total, records, onSeek }) {
  const pct = total > 1 ? (index / (total - 1)) * 100 : 0;
  return (
    <div style={{ marginTop: "var(--space-sm)" }}>
      <input
        type="range"
        min={0}
        max={total - 1}
        value={index}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{
          width: "100%",
          accentColor: "var(--color-signal-teal)",
          cursor: "pointer",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
          {formatTimestamp(records[0]?.timestamp)}
        </span>
        <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
          {formatTimestamp(records[total - 1]?.timestamp)}
        </span>
      </div>
    </div>
  );
}

export default function Replay() {
  const { selectedTimestamp, setSelectedTimestamp, selectedWell } = useAppState();
  const timeline = useApiResource(() => api.riskTimeline({ limit: 120 }, selectedWell), [selectedWell]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(900);

  const records = timeline.data?.records || [];
  const timestamp = records[index]?.timestamp;
  const snapshot = useApiResource(
    () => (timestamp ? api.snapshot(timestamp, selectedWell) : Promise.resolve(null)),
    [timestamp, selectedWell]
  );

  useEffect(() => {
    setSelectedTimestamp(timestamp || null);
  }, [setSelectedTimestamp, timestamp]);

  useEffect(() => {
    if (!playing || !records.length) return undefined;
    const timer = window.setTimeout(() => {
      setIndex((cur) => {
        if (cur >= records.length - 1) { setPlaying(false); return cur; }
        return cur + 1;
      });
    }, speed);
    return () => window.clearTimeout(timer);
  }, [playing, records.length, speed, index]);

  const telemetryRecords = useMemo(() => {
    const tel = snapshot.data?.telemetry;
    return tel ? [tel] : [];
  }, [snapshot.data]);

  const telemetryRows = useMemo(() => measurementRows(snapshot.data?.telemetry), [snapshot.data]);

  if (timeline.state === "loading") return <LoadingState lines={5} />;
  if (timeline.state === "error") return <ErrorState error={timeline.error} />;
  if (!records.length) return <ErrorState title="Replay unavailable" error={new Error("No timeline records returned by the API.")} />;

  const stepBack = () => setIndex((cur) => Math.max(0, cur - 1));
  const stepForward = () => setIndex((cur) => Math.min(records.length - 1, cur + 1));

  const riskColor =
    snapshot.data?.risk?.risk_score == null ? "var(--color-mute)"
    : snapshot.data.risk.risk_score >= 70 ? "var(--color-rust)"
    : snapshot.data.risk.risk_score >= 40 ? "var(--color-brass)"
    : "var(--color-moss)";

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
          Chronological Replay · {selectedWell}
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
          Replay
        </div>
      </div>

      {/* Controls */}
      <ReplayBar
        playing={playing}
        onPlayPause={() => setPlaying((v) => !v)}
        onStepBack={stepBack}
        onStepForward={stepForward}
        speed={speed}
        onSpeedChange={setSpeed}
        index={index}
        total={records.length}
        timestamp={timestamp}
      />

      {/* Scrubber */}
      <Panel>
        <ProgressScrubber index={index} total={records.length} records={records} onSeek={setIndex} />
      </Panel>

      {snapshot.state === "loading" && <LoadingState lines={4} />}
      {snapshot.state === "error" && <ErrorState error={snapshot.error} />}

      {snapshot.state === "success" && snapshot.data && (
        <>
          {/* Risk: gauge + history side by side */}
          <div className="card-grid" style={{ alignItems: "start" }}>
            <div className="span-4">
              <Panel label="Risk Score">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-xs)" }}>
                  <RiskGauge score={snapshot.data.risk?.risk_score ?? null} size={180} />
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)" }}>
                    {snapshot.data.risk?.risk_level ? snapshot.data.risk.risk_level : "—"}
                  </div>
                  {snapshot.data.risk?.explanation && (
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", margin: "4px 0 0", textAlign: "center", lineHeight: 1.5 }}>
                      {snapshot.data.risk.explanation}
                    </p>
                  )}
                </div>
              </Panel>
            </div>
            <div className="span-8">
              <Panel label="Risk History" headerRight={
                <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
                  {records.length} records
                </span>
              }>
                <RiskChart records={records} height={220} selectedTimestamp={timestamp} />
              </Panel>
            </div>
          </div>

          {/* Telemetry trace from snapshot */}
          <Panel label="Snapshot Telemetry" headerRight={
            <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
              {formatTimestamp(snapshot.data.timestamp)}
            </span>
          }>
            <TelemetryChart records={telemetryRecords} fields={TELEMETRY_FIELDS} height={220} />
            {telemetryRows.length > 0 && (
              <div style={{ marginTop: "var(--space-md)", borderTop: "1px solid var(--color-hairline)", paddingTop: "var(--space-md)" }}>
                <DataTable
                  rows={telemetryRows}
                  columns={[
                    { key: "name", header: "Parameter" },
                    { key: "value", header: "Value", render: (row) => formatValue(row.value) },
                    { key: "quality", header: "Status" },
                  ]}
                />
              </div>
            )}
          </Panel>

          {/* Evidence */}
          <EvidenceSummary intelligence={snapshot.data.intelligence} risk={snapshot.data.risk} />
          <ModelEvidence records={snapshot.data.models || []} prototype={snapshot.data.risk?.prototype_supervised} />
        </>
      )}
    </div>
  );
}
