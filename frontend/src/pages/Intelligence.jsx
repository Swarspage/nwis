/**
 * Intelligence — NWIS Drilling Intelligence Workstation.
 *
 * Purpose: "What does NWIS think is happening?"
 *
 * Visual hierarchy:
 *   1. Current System Interpretation panel — anomaly score hero + KV metrics
 *   2. Evidence Cards — clickable M0.5 evidence items (each opens EvidenceDrawer)
 *   3. Anomaly Score Timeline — AnomalyChart with threshold lines
 *   4. Evidence Synthesis — 4-section structured interpretation
 *   5. Quality Flags table
 *
 * Cross-panel:
 *   - Receives focusContext.signal → highlights matching evidence item
 *   - Click evidence card → sets focusContext.evidence (Telemetry highlights channel)
 *   - Click evidence → opens EvidenceDrawer
 *
 * Live polling follows global simulation state.
 */
import { useState } from "react";
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import { useFocusContext, useFocusKeyHandler, FocusBanner, FOCUS_TYPES } from "../components/ui/FocusContext.jsx";
import AnomalyChart from "../components/charts/AnomalyChart.jsx";
import EvidenceSummary from "../components/dashboard/EvidenceSummary.jsx";
import EvidenceDrawer from "../components/dashboard/EvidenceDrawer.jsx";
import Panel from "../components/ui/Panel.jsx";
import LiveBadge from "../components/ui/LiveBadge.jsx";
import DataQualityBadge from "../components/ui/DataQualityBadge.jsx";
import RiskLevelBadge from "../components/ui/RiskLevelBadge.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatPercent, formatTimestamp, formatValue, latest, safeArray, titleize } from "../utils/format.js";

function anomalyColor(score) {
  if (score == null) return "var(--color-mute)";
  if (score >= 0.7) return "var(--color-rust)";
  if (score >= 0.4) return "var(--color-brass)";
  return "var(--color-moss)";
}

function EvidenceCard({ item, index, focused, onClick }) {
  if (typeof item !== "object" || item === null) return null;

  const rawFeature = item.feature || item.signal || item.name || `Evidence ${index + 1}`;
  const featureLabel = rawFeature
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const direction = item.direction;
  const contribution = item.contribution != null ? (item.contribution * 100).toFixed(1) + "%" : null;
  const zScore =
    item.z_score != null
      ? item.z_score >= 0
        ? `+${item.z_score.toFixed(2)}`
        : item.z_score.toFixed(2)
      : null;

  const isHigh = direction === "HIGH" || direction === "ELEVATED";

  const borderColor = focused
    ? "var(--color-signal-teal)"
    : isHigh
    ? "var(--color-brass)"
    : "var(--color-hairline)";

  const bg = focused
    ? "var(--color-signal-teal-soft)"
    : isHigh
    ? "var(--color-brass-soft)"
    : "var(--color-surface-sunken)";

  return (
    <div
      onClick={onClick}
      title="Click to inspect evidence detail"
      className="card-interactive"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--color-ink)",
          }}
        >
          {featureLabel}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {direction && (
            <span
              style={{
                fontFamily: "var(--font-code)",
                fontSize: "10px",
                fontWeight: "var(--weight-medium)",
                padding: "2px 8px",
                borderRadius: "var(--radius-pill)",
                background: isHigh ? "rgba(179,38,30,0.12)" : "rgba(30,138,138,0.12)",
                color: isHigh ? "var(--color-rust)" : "var(--color-signal-teal)",
                letterSpacing: "0.04em",
              }}
            >
              {direction}
            </span>
          )}
          <span
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "10px",
              color: "var(--color-mute)",
            }}
          >
            ↗
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {contribution && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-mute)" }}>
              Contribution:
            </span>
            <span style={{ fontFamily: "var(--font-code)", fontSize: "11px", fontWeight: "var(--weight-medium)", color: "var(--color-ink)" }}>
              {contribution}
            </span>
          </div>
        )}
        {zScore && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-mute)" }}>
              Z-score:
            </span>
            <span style={{ fontFamily: "var(--font-code)", fontSize: "11px", fontWeight: "var(--weight-medium)", color: isHigh ? "var(--color-rust)" : "var(--color-signal-teal)" }}>
              {zScore}
            </span>
          </div>
        )}
      </div>

      {item.explanation && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-body)", margin: "2px 0 0", lineHeight: 1.4 }}>
          {item.explanation}
        </p>
      )}
    </div>
  );
}

export default function Intelligence() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const { focus, isFocused, isTypeFocused, focusContext, clearFocus } = useFocusContext();
  useFocusKeyHandler();

  const isLive =
    simulationState?.mode === "LIVE_SIMULATION" &&
    simulationState?.status === "PLAYING";
  const isSynthetic = selectedWell !== "WELL-1";
  const pollMs = isLive ? 2000 : 0;
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

  const [drawerEvidence, setDrawerEvidence] = useState(null);

  const intelligence = useApiResource(
    () => api.intelligence(ts ? { timestamp: ts, limit: 120 } : { limit: 120 }, selectedWell),
    [ts, selectedWell],
    pollMs
  );

  // Load latest telemetry for drawer channel values
  const telemetry = useApiResource(
    () => api.telemetry({ limit: 1 }, selectedWell),
    [selectedWell],
    pollMs
  );

  if (intelligence.state === "loading") return <LoadingState lines={5} />;
  if (intelligence.state === "error") return <ErrorState error={intelligence.error} />;

  const records = intelligence.data?.records || [];
  const current = latest(records);
  const evidence = safeArray(current?.evidence || []);
  const qualityRows = Object.entries(current?.quality_flags || {}).map(([name, value]) => ({ name, value }));
  const anomalyScore = current?.anomaly_score ?? null;
  const latestTelemetry = telemetry.data?.records?.[telemetry.data.records.length - 1] ?? null;

  // If there's a signal focus from Telemetry, auto-highlight matching evidence
  const focusedSignalKey = isTypeFocused(FOCUS_TYPES.SIGNAL) ? focusContext?.key : null;

  const getEvidenceKey = (item) => item.feature || item.signal || item.name || "";

  const isEvidenceFocused = (item) => {
    // Highlighted if: direct evidence focus OR signal focus that matches this feature key
    const key = getEvidenceKey(item);
    return (
      isFocused(FOCUS_TYPES.EVIDENCE, key) ||
      (focusedSignalKey && key.includes(focusedSignalKey))
    );
  };

  const handleEvidenceClick = (item) => {
    const key = getEvidenceKey(item);
    const label = key.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
    focus(FOCUS_TYPES.EVIDENCE, key, label);
    setDrawerEvidence(item);
  };

  return (
    <div className="page">
      {/* Evidence Drawer */}
      <EvidenceDrawer
        open={!!drawerEvidence}
        onClose={() => { setDrawerEvidence(null); }}
        evidence={drawerEvidence}
        telemetry={latestTelemetry}
      />

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
          M0.5 Deterministic Intelligence · {selectedWell}
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
            Drilling Intelligence
          </h1>
          {isLive && <LiveBadge />}
          {isSynthetic && !isLive && <DataQualityBadge status="synthetic" />}
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
          What does NWIS detect and why?
        </p>
      </div>

      {/* Focus banner — shows when Telemetry signals a focused channel */}
      <FocusBanner />

      {/* Hero: Current System Interpretation */}
      <Panel title="Current System Interpretation">
        <div style={{ display: "flex", gap: "var(--space-xl)", flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* Anomaly score hero */}
          <div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-label-sm)",
                color: "var(--color-mute)",
                marginBottom: 4,
              }}
            >
              Anomaly Score
            </div>
            <div
              style={{
                fontFamily: "var(--font-code)",
                fontSize: "34px",
                fontWeight: "var(--weight-semibold)",
                color: anomalyColor(anomalyScore),
                lineHeight: 1.05,
              }}
            >
              {anomalyScore != null ? anomalyScore.toFixed(3) : "—"}
            </div>
          </div>

          <div style={{ width: 1, height: 52, background: "var(--color-hairline)", alignSelf: "center" }} />

          {/* KV metrics */}
          {[
            { label: "Risk Level", content: <RiskLevelBadge level={current?.risk_level} /> },
            { label: "Confidence", content: <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-ink)" }}>{formatPercent(current?.confidence)}</span> },
            { label: "Status", content: <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-ink)" }}>{titleize(current?.intelligence_status)}</span> },
          ].map(({ label, content }) => (
            <div key={label}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", marginBottom: 4 }}>
                {label}
              </div>
              {content || <span style={{ color: "var(--color-mute)" }}>—</span>}
            </div>
          ))}

          <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
            <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
              {formatTimestamp(current?.timestamp)}
            </div>
          </div>
        </div>
      </Panel>

      {/* Evidence Cards — clickable */}
      <Panel
        label="Why NWIS Flagged This"
        title="Evidence"
        headerRight={
          evidence.length > 0 && (
            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)" }}>
              Click evidence to inspect detail
            </span>
          )
        }
      >
        {evidence.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--space-sm)",
            }}
          >
            {evidence.map((item, i) => (
              <EvidenceCard
                key={i}
                item={item}
                index={i}
                focused={isEvidenceFocused(item)}
                onClick={() => handleEvidenceClick(item)}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: "var(--space-xl)",
              textAlign: "center",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--color-hairline-strong)",
              background: "var(--color-canvas)",
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-heading-md)", color: "var(--color-mute)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-xs)" }}>
              No evidence at this timestamp
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)", margin: 0, maxWidth: 400, marginInline: "auto" }}>
              The API returned an empty evidence array. This indicates normal operational state with no detected anomalous behaviour at the selected timestamp.
            </p>
          </div>
        )}
      </Panel>

      {/* Anomaly Score Trace */}
      <Panel
        label="Anomaly Score Trace"
        headerRight={
          <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
            {records.length} records
          </span>
        }
      >
        <AnomalyChart records={records} height={220} />
      </Panel>

      {/* Evidence Synthesis */}
      <Panel title="Evidence Synthesis">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          {[
            {
              heading: "Current Observation",
              body: anomalyScore != null
                ? `Anomaly score: ${anomalyScore.toFixed(3)}. Risk level reported as ${titleize(current?.risk_level) || "unknown"}. Intelligence status: ${titleize(current?.intelligence_status) || "unknown"}.`
                : "No current observation data available from the intelligence API.",
            },
            {
              heading: "Analytical Evidence",
              body: evidence.length > 0
                ? `${evidence.length} evidence item${evidence.length > 1 ? "s" : ""} returned by M0.5 deterministic intelligence. ${evidence.filter((e) => e.direction === "HIGH" || e.direction === "ELEVATED").length} show elevated or high direction.`
                : "No analytical evidence returned for this timestamp.",
            },
            {
              heading: "Data Limitations",
              body: (() => {
                const flags = Object.entries(current?.quality_flags || {});
                if (flags.length === 0) return "No data quality flags reported.";
                return `Quality flags: ${flags.map(([k]) => k.replaceAll("_", " ")).join(", ")}.`;
              })(),
            },
            {
              heading: "Engineering Review",
              body: "Anomaly scores are statistical observations from M0.5 deterministic and M0.6 statistical models. Review parameter behaviour in context before drawing operational conclusions. NWIS does not issue operational commands.",
            },
          ].map(({ heading, body }) => (
            <div
              key={heading}
              style={{
                background: "var(--color-canvas)",
                border: "1px solid var(--color-hairline)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-md)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-label-sm)",
                  fontWeight: "var(--weight-medium)",
                  color: "var(--color-slate)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-label-sm)",
                  marginBottom: "var(--space-xs)",
                }}
              >
                {heading}
              </div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-body)",
                  margin: 0,
                  lineHeight: "var(--leading-body-sm)",
                }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Quality flags */}
      {qualityRows.length > 0 && (
        <Panel label="Quality Flags">
          <DataTable
            rows={qualityRows}
            columns={[
              { key: "name", header: "Flag", render: (row) => titleize(row.name) },
              { key: "value", header: "Value", render: (row) => formatValue(row.value) },
            ]}
            empty="No quality flags returned."
          />
        </Panel>
      )}
    </div>
  );
}
