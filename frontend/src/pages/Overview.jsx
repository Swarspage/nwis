import { useCallback, useRef } from "react";
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import TelemetryChart from "../components/charts/TelemetryChart.jsx";
import RiskChart from "../components/charts/RiskChart.jsx";
import RiskGauge from "../components/charts/RiskGauge.jsx";
import WellViewport3D from "../components/visualization/WellViewport3D.jsx";
import EvidenceSummary from "../components/dashboard/EvidenceSummary.jsx";
import HistoricalContext from "../components/dashboard/HistoricalContext.jsx";
import ModelEvidence from "../components/dashboard/ModelEvidence.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, latest, titleize } from "../utils/format.js";

// Well context bar colors
const WELL_BAR_BG = "#0A2540";
const WELL_BAR_TEXT = "#EAF0EE";

function WellContextBar({ wellId, isLive, isSynthetic, simulationState, timestamp }) {
  const modeLabel = isLive ? "Live Simulation" : "Replay";
  const dataOriginLabel = isSynthetic ? "Synthetic Demo" : "Historical Source";
  const simTs = simulationState?.current_sim_time;

  return (
    <div
      style={{
        background: WELL_BAR_BG,
        borderRadius: "var(--radius-lg)",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-lg)",
        flexWrap: "wrap",
      }}
    >
      {/* Well ID */}
      <div>
        <div
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-data-lg)",
            fontWeight: "var(--weight-medium)",
            color: WELL_BAR_TEXT,
            lineHeight: 1.2,
          }}
        >
          {wellId}
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-label-sm)",
            color: "rgba(234,240,238,0.55)",
            marginTop: 2,
          }}
        >
          {dataOriginLabel}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: "rgba(234,240,238,0.15)" }} />

      {/* Mode pill */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-label-sm)",
            color: "rgba(234,240,238,0.55)",
          }}
        >
          Mode
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--weight-medium)",
            color: isLive ? "var(--color-signal-teal)" : "rgba(234,240,238,0.8)",
          }}
        >
          {isLive && (
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--color-signal-teal)",
                animation: "livePulse 1.8s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
          )}
          {modeLabel}
        </div>
      </div>

      {/* Timestamp */}
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <div
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-data-sm)",
            color: "rgba(234,240,238,0.55)",
          }}
        >
          {isLive && simTs ? "Sim clock" : "Selected"}
        </div>
        <div
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-data-sm)",
            color: WELL_BAR_TEXT,
            marginTop: 1,
          }}
        >
          {formatTimestamp(isLive && simTs ? simTs : timestamp) || "—"}
        </div>
      </div>
    </div>
  );
}

function RiskPanel({ risk, riskTimeline, selectedTimestamp }) {
  const score = risk?.risk_score ?? null;
  const riskColor =
    score == null ? "var(--color-mute)" : score >= 70 ? "var(--color-rust)" : score >= 40 ? "var(--color-brass)" : "var(--color-moss)";

  // M0.5 evidence summary
  const m05 = risk?.analytical_evidence?.m05;
  const m06 = risk?.analytical_evidence?.m06;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-hairline)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
      }}
    >
      {/* Gauge + score */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
        <RiskGauge score={score} size={160} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-label-sm)",
              color: "var(--color-mute)",
              marginBottom: 4,
            }}
          >
            M0.8 Risk Score
          </div>
          <div
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-display-lg)",
              fontWeight: "var(--weight-medium)",
              color: riskColor,
              lineHeight: 1.1,
            }}
          >
            {score != null ? score.toFixed(1) : "—"}
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              color: riskColor,
              fontWeight: "var(--weight-medium)",
              marginTop: 4,
            }}
          >
            {titleize(risk?.risk_level) || "—"}
          </div>
          {risk?.explanation && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-body)",
                margin: "8px 0 0",
                lineHeight: "var(--leading-body-sm)",
              }}
            >
              {risk.explanation}
            </p>
          )}
        </div>
      </div>

      {/* M0.5 / M0.6 contribution bars */}
      <div style={{ borderTop: "1px solid var(--color-hairline)", paddingTop: "var(--space-sm)" }}>
        <EvidenceBar label="M0.5 Intelligence" value={m05?.score} />
        <EvidenceBar label="M0.6 Models" value={m06?.score} />
      </div>

      {/* Risk timeline */}
      {riskTimeline?.length > 0 && (
        <RiskChart records={riskTimeline} height={100} selectedTimestamp={selectedTimestamp} />
      )}
    </div>
  );
}

function EvidenceBar({ label, value }) {
  const pct = value != null ? Math.min(100, Math.max(0, value)) : null;
  const barColor =
    pct == null ? "var(--color-hairline)"
    : pct >= 70 ? "var(--color-rust)"
    : pct >= 40 ? "var(--color-brass)"
    : "var(--color-moss)";

  return (
    <div style={{ marginBottom: "var(--space-xs)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 3,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-label-sm)",
            color: "var(--color-mute)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-data-sm)",
            color: "var(--color-body)",
          }}
        >
          {pct != null ? `${pct.toFixed(1)}` : "—"}
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: "var(--radius-pill)",
          background: "var(--color-hairline)",
          overflow: "hidden",
        }}
      >
        {pct != null && (
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: barColor,
              borderRadius: "var(--radius-pill)",
              transition: "width 420ms cubic-bezier(0.2,0.8,0.2,1)",
            }}
          />
        )}
      </div>
    </div>
  );
}

const TELEMETRY_FIELDS = [
  { key: "standpipe_pressure", label: "Standpipe Pressure" },
  { key: "flow_rate", label: "Flow Rate" },
  { key: "hookload", label: "Hookload" },
  { key: "torque", label: "Torque" },
];

export default function Overview() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const isLive = simulationState?.mode === "LIVE_SIMULATION" && simulationState?.status === "PLAYING";
  const isSynthetic = selectedWell !== "WELL-1";
  const ts = simulationMode === "replay" ? selectedTimestamp : null;
  const pollMs = isLive ? 1000 : 0;

  const risk = useApiResource(
    () => (ts ? api.riskAt(ts, selectedWell) : api.currentRisk(selectedWell)),
    [ts, selectedWell],
    pollMs
  );
  const timelineData = useApiResource(
    () => api.riskTimeline({ limit: 100 }, selectedWell),
    [selectedWell],
    pollMs
  );
  const telemetry = useApiResource(
    () => api.telemetry(ts ? { timestamp: ts, limit: 100 } : { limit: 100 }, selectedWell),
    [ts, selectedWell],
    pollMs
  );
  const intelligence = useApiResource(
    () => api.intelligence(ts ? { timestamp: ts, limit: 51 } : { limit: 51 }, selectedWell),
    [ts, selectedWell],
    pollMs
  );
  const models = useApiResource(
    () => api.models(ts ? { timestamp: ts, limit: 153 } : { limit: 153 }, selectedWell),
    [ts, selectedWell],
    pollMs
  );
  const historical = useApiResource(() => api.historicalEvents(selectedWell), [selectedWell]);

  // Don't block on historical or secondary data — show skeleton for primary only
  const primaryLoading = risk.state === "loading" || telemetry.state === "loading";
  const primaryError = risk.state === "error";

  if (primaryLoading) return <LoadingState lines={6} />;
  if (primaryError) return <ErrorState error={risk.error} />;

  const riskData = risk.data;
  const riskTimeline = timelineData.data?.records || [];
  const telemetryRecords = telemetry.data?.records || [];
  const latestTimestamp = riskData?.timestamp;
  const latestModels = (models.data?.records || []).filter((r) => r.timestamp === latestTimestamp);
  const latestIntelligence = latest(intelligence.data?.records || []);
  const depthVal = null; // No verified depth channel per project docs

  return (
    <div className="page">
      {/* Well Context Bar */}
      <WellContextBar
        wellId={selectedWell}
        isLive={isLive}
        isSynthetic={isSynthetic}
        simulationState={simulationState}
        timestamp={latestTimestamp}
      />

      {/* Primary hero row: Risk Panel + 3D Viewport */}
      <div className="card-grid" style={{ alignItems: "center" }}>
        <div className="span-5">
          <RiskPanel
            risk={riskData}
            riskTimeline={riskTimeline}
            selectedTimestamp={selectedTimestamp}
          />
        </div>
        <div className="span-7" style={{ position: "relative" }}>
          {/* A soft glowing backdrop to ground the floating model */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            height: "80%",
            background: "radial-gradient(circle, rgba(30,138,138,0.15) 0%, rgba(6,22,39,0) 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
            zIndex: 0
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <WellViewport3D
              wellId={selectedWell}
              riskScore={riskData?.risk_score}
              telemetry={latest(telemetryRecords)}
              simulationState={simulationState}
              height={560}
            />
          </div>
        </div>
      </div>

      {/* Live telemetry 4-series ECharts */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-hairline)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
        }}
      >
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
          <div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-heading-sm)",
                fontWeight: "var(--weight-semibold)",
                color: "var(--color-ink)",
              }}
            >
              Live Telemetry
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-body)",
                marginTop: 2,
              }}
            >
              {telemetryRecords.length} records · M0.4 payload
            </div>
          </div>
          {isLive && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "var(--color-signal-teal-soft)",
                color: "var(--color-signal-teal)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-label-sm)",
                fontWeight: "var(--weight-medium)",
                padding: "4px 10px",
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
        <TelemetryChart
          records={telemetryRecords}
          fields={TELEMETRY_FIELDS}
          height={260}
        />
      </div>

      {/* Bottom row: M0.5 Evidence + M0.6 Models + Historical Context */}
      <div className="card-grid" style={{ alignItems: "start" }}>
        <div className="span-4">
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-lg)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-label-sm)",
                fontWeight: "var(--weight-medium)",
                color: "var(--color-mute)",
                marginBottom: "var(--space-sm)",
              }}
            >
              M0.5 Intelligence
            </div>
            <EvidenceSummary intelligence={latestIntelligence} risk={riskData} />
          </div>
        </div>

        <div className="span-4">
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-lg)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-label-sm)",
                fontWeight: "var(--weight-medium)",
                color: "var(--color-mute)",
                marginBottom: "var(--space-sm)",
              }}
            >
              M0.6 Model Evidence
            </div>
            <ModelEvidence records={latestModels} prototype={riskData?.prototype_supervised} compact />
          </div>
        </div>

        <div className="span-4">
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-lg)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-label-sm)",
                fontWeight: "var(--weight-medium)",
                color: "var(--color-mute)",
                marginBottom: "var(--space-sm)",
              }}
            >
              M0.7 Historical Context
            </div>
            <HistoricalContext historical={historical.data} />
          </div>
        </div>
      </div>
    </div>
  );
}
