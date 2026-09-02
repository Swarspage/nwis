/**
 * Replay — Chronological timeline replay (WELL-1 historical).
 *
 * Visual hierarchy:
 *   1. Controls bar (dark, consistent with SimulationControls aesthetic)
 *   2. Timeline scrubber with timestamp endpoints
 *   3. Synchronized snapshot view:
 *      - LEFT: Risk gauge + KV metrics (score, level, alert, confidence)
 *      - RIGHT: Risk chart with selected timestamp marker
 *   4. Snapshot telemetry chart + values
 *   5. Evidence: EvidenceSummary + ModelEvidence
 *
 * Cross-panel (Replay-level timestamp sync):
 *   - Scrubbing sets focusContext.timestamp so all panels communicate "snapshot at this moment"
 *   - setSelectedTimestamp in AppState already wired — focusContext is additive
 *
 * Replay has its own index/speed state, independent of simulation clock.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import { useFocusContext, FOCUS_TYPES } from "../components/ui/FocusContext.jsx";
import RiskGauge from "../components/charts/RiskGauge.jsx";
import RiskChart from "../components/charts/RiskChart.jsx";
import TelemetryChart from "../components/charts/TelemetryChart.jsx";
import EvidenceSummary from "../components/dashboard/EvidenceSummary.jsx";
import ModelEvidence from "../components/dashboard/ModelEvidence.jsx";
import Panel from "../components/ui/Panel.jsx";
import RiskLevelBadge from "../components/ui/RiskLevelBadge.jsx";
import DataQualityBadge from "../components/ui/DataQualityBadge.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, formatPercent, formatValue, measurementRows } from "../utils/format.js";
import DataTable from "../components/ui/DataTable.jsx";

const TELEMETRY_FIELDS = [
  { key: "standpipe_pressure", label: "Standpipe Pressure" },
  { key: "flow_rate",          label: "Flow Rate" },
  { key: "hookload",           label: "Hookload" },
  { key: "torque",             label: "Torque" },
];

// ── Replay controls bar ──────────────────────────────────────
function ReplayBar({ playing, onPlayPause, onStepBack, onStepForward, speed, onSpeedChange, index, total, timestamp }) {
  const SPEEDS = [300, 600, 900, 1800];

  return (
    <div style={{
      background: "var(--color-ink)",
      borderRadius: "var(--radius-lg)",
      padding: "12px var(--space-lg)",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-md)",
      flexWrap: "wrap",
    }}>
      <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", fontWeight: "var(--weight-medium)", color: "rgba(234,240,238,0.45)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
        Replay
      </span>

      <div style={{ width: 1, height: 18, background: "rgba(234,240,238,0.12)" }} />

      {/* Step back */}
      <button onClick={onStepBack} style={{ background: "rgba(234,240,238,0.08)", color: "rgba(234,240,238,0.6)", border: "none", borderRadius: "var(--radius-sm)", padding: "5px 10px", cursor: "pointer", fontFamily: "var(--font-code)", fontSize: 14 }}>
        ‹
      </button>

      {/* Play/Pause */}
      <button onClick={onPlayPause} style={{ display: "flex", alignItems: "center", gap: 6, background: playing ? "var(--color-signal-teal)" : "rgba(234,240,238,0.1)", color: playing ? "#fff" : "rgba(234,240,238,0.8)", border: "none", borderRadius: "var(--radius-md)", padding: "6px 14px", fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", fontWeight: "var(--weight-medium)", cursor: "pointer", transition: "background 220ms" }}>
        {playing ? (
          <><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8" rx="1" /><rect x="6" y="1" width="3" height="8" rx="1" /></svg>Pause</>
        ) : (
          <><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9" /></svg>Play</>
        )}
      </button>

      {/* Step forward */}
      <button onClick={onStepForward} style={{ background: "rgba(234,240,238,0.08)", color: "rgba(234,240,238,0.6)", border: "none", borderRadius: "var(--radius-sm)", padding: "5px 10px", cursor: "pointer", fontFamily: "var(--font-code)", fontSize: 14 }}>
        ›
      </button>

      <div style={{ width: 1, height: 18, background: "rgba(234,240,238,0.12)" }} />

      {/* Interval speed */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "rgba(234,240,238,0.35)", marginRight: 4 }}>Interval</span>
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => onSpeedChange(s)} style={{ background: speed === s ? "var(--color-signal-teal)" : "rgba(234,240,238,0.07)", color: speed === s ? "#fff" : "rgba(234,240,238,0.55)", border: "none", borderRadius: "var(--radius-sm)", padding: "4px 9px", fontFamily: "var(--font-code)", fontSize: 11, cursor: "pointer", transition: "background 120ms, color 120ms" }}>
            {s}ms
          </button>
        ))}
      </div>

      {/* Progress + timestamp */}
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "rgba(234,240,238,0.35)" }}>
          {index + 1} / {total}
        </div>
        <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "rgba(234,240,238,0.7)", marginTop: 1 }}>
          {formatTimestamp(timestamp)}
        </div>
      </div>
    </div>
  );
}

// ── Timeline scrubber ────────────────────────────────────────
function ProgressScrubber({ index, total, records, onSeek }) {
  return (
    <div>
      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={index}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--color-signal-teal)", cursor: "pointer" }}
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

// ── Snapshot KV metric ───────────────────────────────────────
function SnapKV({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-ink)" }}>{children}</div>
    </div>
  );
}

export default function Replay() {
  const { selectedTimestamp, setSelectedTimestamp, selectedWell } = useAppState();
  const { focus } = useFocusContext();

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

  // Sync replay position to global timestamp (for other pages that listen to selectedTimestamp)
  useEffect(() => {
    setSelectedTimestamp(timestamp || null);
  }, [setSelectedTimestamp, timestamp]);

  // Also push to focusContext so any page can react to the current replay timestamp
  useEffect(() => {
    if (timestamp) {
      focus(FOCUS_TYPES.TIMESTAMP, timestamp, formatTimestamp(timestamp));
    }
  }, [timestamp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance timer
  useEffect(() => {
    if (!playing || !records.length) return;
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

  const stepBack    = () => setIndex((cur) => Math.max(0, cur - 1));
  const stepForward = () => setIndex((cur) => Math.min(records.length - 1, cur + 1));

  const riskScore = snapshot.data?.risk?.risk_score ?? null;
  const riskLevel = snapshot.data?.risk?.risk_level ?? null;
  const alertActive = snapshot.data?.risk?.alert === true;

  return (
    <div className="page">
      {/* Page header */}
      <div style={{ marginBottom: "var(--space-sm)" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Chronological Replay · {selectedWell}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap", marginTop: 4 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-xl)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)", margin: 0, letterSpacing: "var(--tracking-display-xl)" }}>
            Replay
          </h1>
          <DataQualityBadge status="historical" label={`${records.length} snapshots`} />
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-md)", color: "var(--color-body)", margin: "var(--space-xs) 0 0", lineHeight: "var(--leading-body-md)" }}>
          Step through historical risk and telemetry snapshots. All panels synchronize to the selected timestamp.
        </p>
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
          {/* Synchronized snapshot banner */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            padding: "8px 14px",
            background: "var(--color-canvas-deep)",
            border: "1px solid var(--color-hairline-strong)",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            color: "var(--color-slate)",
          }}>
            <span style={{ fontWeight: "var(--weight-medium)" }}>Snapshot at</span>
            <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-ink)" }}>
              {formatTimestamp(snapshot.data.timestamp)}
            </span>
            <span style={{ color: "var(--color-mute)" }}>· All panels synchronized to this timestamp</span>
          </div>

          {/* Side-by-side: gauge + risk chart */}
          <div className="card-grid" style={{ alignItems: "stretch" }}>
            {/* Gauge + KV */}
            <div className="span-4">
              <Panel label="Risk Snapshot" style={{ height: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-sm)" }}>
                  <RiskGauge score={riskScore} size={180} />
                  <RiskLevelBadge level={riskLevel} />
                  {alertActive && (
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-rust)", fontWeight: "var(--weight-medium)" }}>
                      ▲ Alert active at this timestamp
                    </span>
                  )}
                  {snapshot.data.risk?.explanation && (
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
                      {snapshot.data.risk.explanation}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "var(--space-lg)", flexWrap: "wrap", justifyContent: "center", marginTop: "var(--space-xs)" }}>
                    <SnapKV label="Confidence">{formatPercent(snapshot.data.risk?.confidence)}</SnapKV>
                    <SnapKV label="Record">{index + 1} / {records.length}</SnapKV>
                  </div>
                </div>
              </Panel>
            </div>

            {/* Risk history with selected marker */}
            <div className="span-8">
              <Panel
                label="Risk History"
                headerRight={
                  <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
                    {records.length} records · current marked ▲
                  </span>
                }
                style={{ height: "100%" }}
              >
                <RiskChart records={records} height={240} selectedTimestamp={timestamp} />
              </Panel>
            </div>
          </div>

          {/* Snapshot telemetry chart */}
          <Panel
            label="Snapshot Telemetry"
            headerRight={
              <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
                {formatTimestamp(snapshot.data.timestamp)}
              </span>
            }
          >
            <TelemetryChart records={telemetryRecords} fields={TELEMETRY_FIELDS} height={220} compact />
            {telemetryRows.length > 0 && (
              <div style={{ marginTop: "var(--space-md)", borderTop: "1px solid var(--color-hairline)", paddingTop: "var(--space-md)" }}>
                <DataTable
                  rows={telemetryRows}
                  columns={[
                    { key: "name",    header: "Parameter" },
                    { key: "value",   header: "Value", render: (row) => formatValue(row.value) },
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
