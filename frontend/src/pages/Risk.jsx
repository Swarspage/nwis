/**
 * Risk — M0.8 Risk Fusion Intelligence Center.
 *
 * Visual hierarchy:
 *   1. Hero: RiskGauge + score + RiskLevelBadge + alert state
 *   2. Risk Drivers — M0.5 evidence ordered by contribution (clickable → focus)
 *   3. Fusion Architecture — visual M0.5 block | M0.6 block → fused score
 *   4. Risk Timeline — RiskChart with threshold lines
 *   5. Fusion Weights — from API analytical_evidence.fusion_metadata
 *
 * Cross-panel:
 *   - Click risk driver → sets focusContext.driver (Models highlights contributing model)
 *   - Responds to focusContext.evidence → highlights that driver
 *
 * Live polling follows global simulation state.
 */
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import { useFocusContext, useFocusKeyHandler, FocusBanner, FOCUS_TYPES } from "../components/ui/FocusContext.jsx";
import RiskGauge from "../components/charts/RiskGauge.jsx";
import RiskChart from "../components/charts/RiskChart.jsx";
import ContributionBars from "../components/charts/ContributionBars.jsx";
import Panel from "../components/ui/Panel.jsx";
import LiveBadge from "../components/ui/LiveBadge.jsx";
import RiskLevelBadge from "../components/ui/RiskLevelBadge.jsx";
import DataQualityBadge from "../components/ui/DataQualityBadge.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EvidenceDrawer from "../components/dashboard/EvidenceDrawer.jsx";
import { useState } from "react";
import { formatPercent, formatTimestamp, formatValue, safeArray, titleize } from "../utils/format.js";

function riskScoreColor(score) {
  if (score == null) return "var(--color-mute)";
  if (score >= 70) return "var(--color-rust)";
  if (score >= 40) return "var(--color-brass)";
  return "var(--color-moss)";
}

function RiskDriverCard({ item, focused, onClick }) {
  if (!item || typeof item !== "object") return null;
  const rawFeature = item.feature || item.signal || item.name || "Unknown";
  const featureLabel = rawFeature
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const isHigh = item.direction === "HIGH" || item.direction === "ELEVATED";
  const contribution = item.contribution != null ? (item.contribution * 100).toFixed(1) : null;
  const barPct = item.contribution != null ? Math.min(100, Math.abs(item.contribution) * 100) : 0;

  return (
    <div
      onClick={onClick}
      title="Click to inspect — sets focus for Models page"
      className="card-interactive"
      style={{
        background: focused ? "var(--color-signal-teal-soft)" : "var(--color-surface)",
        border: `1px solid ${focused ? "var(--color-signal-teal)" : "var(--color-hairline)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)" }}>
          {featureLabel}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {item.direction && (
            <span style={{
              fontFamily: "var(--font-code)", fontSize: "10px", fontWeight: "var(--weight-medium)",
              padding: "2px 8px", borderRadius: "var(--radius-pill)",
              background: isHigh ? "rgba(179,38,30,0.12)" : "rgba(30,138,138,0.12)",
              color: isHigh ? "var(--color-rust)" : "var(--color-signal-teal)",
            }}>
              {item.direction}
            </span>
          )}
          {contribution && (
            <span style={{ fontFamily: "var(--font-code)", fontSize: "11px", color: "var(--color-mute)" }}>
              {contribution}%
            </span>
          )}
        </div>
      </div>

      {/* Contribution bar */}
      {barPct > 0 && (
        <div style={{ height: 3, background: "var(--color-hairline)", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${barPct}%`,
              background: isHigh ? "var(--color-brass)" : "var(--color-signal-teal)",
              borderRadius: 2,
              transition: "width 420ms var(--ease-emphasis)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function FusionBlock({ label, layer, weight, score, available }) {
  const pct = weight != null ? (weight * 100).toFixed(0) : "?";
  const scoreStr = score != null ? score.toFixed(2) : "—";
  const levelColor = layer?.level
    ? { ELEVATED: "var(--color-rust)", WATCH: "var(--color-brass)", NORMAL: "var(--color-moss)" }[layer.level?.toUpperCase()] || "var(--color-mute)"
    : "var(--color-mute)";

  return (
    <div style={{
      flex: 1,
      minWidth: 120,
      background: "var(--color-canvas)",
      border: "1px solid var(--color-hairline)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-md)",
    }}>
      <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "var(--space-xs)" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-code)", fontSize: "22px", fontWeight: "var(--weight-medium)", color: "var(--color-ink)", lineHeight: 1.2 }}>
        {scoreStr}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginTop: "var(--space-xs)", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-mute)" }}>
          Weight: <strong style={{ fontFamily: "var(--font-code)", color: "var(--color-ink)" }}>{pct}%</strong>
        </span>
        {layer?.level && (
          <span style={{ fontFamily: "var(--font-code)", fontSize: "10px", color: levelColor, fontWeight: "var(--weight-medium)" }}>
            {layer.level}
          </span>
        )}
        {!available && (
          <DataQualityBadge status="unavailable" label="Layer Unavailable" />
        )}
      </div>
    </div>
  );
}

export default function Risk() {
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

  const risk = useApiResource(
    () => (ts ? api.riskAt(ts, selectedWell) : api.currentRisk(selectedWell)),
    [ts, selectedWell],
    pollMs
  );
  const timeline = useApiResource(
    () => api.riskTimeline({ limit: 120 }, selectedWell),
    [selectedWell],
    pollMs
  );

  if (risk.state === "loading") return <LoadingState lines={5} />;
  if (risk.state === "error") return <ErrorState error={risk.error} />;

  const riskData = risk.data;
  const score = riskData?.risk_score ?? null;
  const scoreColor = riskScoreColor(score);
  const alertActive = riskData?.alert === true || riskData?.alert === "true";

  const analytical = riskData?.analytical_evidence || {};
  const fusion = analytical.fusion_metadata || {};
  const configuredWeights = fusion.configured_weights || {};
  const effectiveWeights = fusion.effective_weights || {};
  const m05Layer = analytical.m05;
  const m06Layer = analytical.m06;

  const m05Evidence = safeArray(m05Layer?.evidence || riskData?.analytical_evidence?.m05?.evidence || []);
  const weightRows = Object.entries(configuredWeights).map(([layer, configured]) => ({
    layer: layer.toUpperCase(),
    configured,
    effective: effectiveWeights[layer],
  }));

  const riskTimeline = timeline.data?.records || [];

  // Driver focus: matches focusContext.evidence to highlight corresponding driver
  const focusedEvidenceKey = isTypeFocused(FOCUS_TYPES.EVIDENCE) ? focusContext?.key : null;
  const getDriverKey = (item) => item.feature || item.signal || item.name || "";
  const isDriverFocused = (item) => {
    const key = getDriverKey(item);
    return (
      isFocused(FOCUS_TYPES.DRIVER, key) ||
      (focusedEvidenceKey && key.includes(focusedEvidenceKey))
    );
  };

  const handleDriverClick = (item) => {
    const key = getDriverKey(item);
    const label = key.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
    focus(FOCUS_TYPES.DRIVER, key, label);
    setDrawerEvidence(item);
  };

  return (
    <div className="page">
      {/* Evidence Drawer */}
      <EvidenceDrawer
        open={!!drawerEvidence}
        onClose={() => setDrawerEvidence(null)}
        evidence={drawerEvidence}
      />

      {/* Page header */}
      <div style={{ marginBottom: "var(--space-sm)" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          M0.8 Risk Fusion · {selectedWell}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap", marginTop: 4 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-xl)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)", margin: 0, letterSpacing: "var(--tracking-display-xl)" }}>
            Risk Intelligence
          </h1>
          {isLive && <LiveBadge />}
          {isSynthetic && !isLive && <DataQualityBadge status="synthetic" />}
          {alertActive && (
            <span style={{
              background: "var(--color-rust-soft)", border: "1px solid var(--color-rust)",
              color: "var(--color-rust)", fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)",
              fontWeight: "var(--weight-medium)", padding: "3px 10px", borderRadius: "var(--radius-pill)",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ fontSize: 8 }}>▲</span> Active Alert
            </span>
          )}
        </div>
      </div>

      <FocusBanner />

      {/* Hero: Gauge + score + alert */}
      <Panel>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-xl)", flexWrap: "wrap" }}>
          <RiskGauge score={score} size={200} />
          <div style={{ flex: 1, minWidth: 200, paddingTop: "var(--space-md)" }}>
            <div style={{ fontFamily: "var(--font-code)", fontSize: "34px", fontWeight: "var(--weight-semibold)", color: scoreColor, lineHeight: 1.05, marginBottom: "var(--space-xs)" }}>
              {score != null ? score.toFixed(1) : "—"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)", flexWrap: "wrap" }}>
              <RiskLevelBadge level={riskData?.risk_level} />
              {!alertActive && (
                <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-moss)" }}>
                  No active alert
                </span>
              )}
            </div>
            {riskData?.explanation && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", lineHeight: "var(--leading-body-sm)", margin: "0 0 var(--space-md)", maxWidth: 440 }}>
                {riskData.explanation}
              </p>
            )}
            <div style={{ display: "flex", gap: "var(--space-lg)", flexWrap: "wrap" }}>
              {[
                { label: "Confidence", value: formatPercent(riskData?.confidence) },
                { label: "Timestamp", value: formatTimestamp(riskData?.timestamp) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)" }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-ink)", marginTop: 2 }}>{value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* Risk Drivers (M0.5 evidence ordered by contribution) */}
      <Panel
        label="Risk Drivers"
        title="What's Driving Risk"
        headerRight={
          m05Evidence.length > 0 && (
            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)" }}>
              Click a driver to inspect · sets cross-panel focus
            </span>
          )
        }
      >
        {m05Evidence.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-sm)" }}>
            {[...m05Evidence]
              .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))
              .map((item, i) => (
                <RiskDriverCard
                  key={i}
                  item={item}
                  focused={isDriverFocused(item)}
                  onClick={() => handleDriverClick(item)}
                />
              ))}
          </div>
        ) : (
          <div style={{ padding: "var(--space-xl)", textAlign: "center", borderRadius: "var(--radius-md)", border: "1px dashed var(--color-hairline-strong)", background: "var(--color-canvas)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-heading-md)", color: "var(--color-mute)", fontWeight: "var(--weight-medium)" }}>
              No risk drivers at this timestamp
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)", margin: "var(--space-xs) 0 0" }}>
              M0.5 returned no evidence for this record.
            </p>
          </div>
        )}
      </Panel>

      {/* Fusion Architecture */}
      <Panel label="Fusion Architecture" title="How NWIS Combines Intelligence">
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", margin: "0 0 var(--space-md)", lineHeight: "var(--leading-body-sm)" }}>
          Risk score is a weighted fusion of M0.5 deterministic intelligence and M0.6 statistical models.
          Weights below are from the backend analytical_evidence.fusion_metadata payload.
        </p>
        <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "stretch", flexWrap: "wrap" }}>
          <FusionBlock
            label="M0.5 Deterministic"
            layer={m05Layer}
            weight={configuredWeights.m05 ?? configuredWeights.intelligence}
            score={m05Layer?.score}
            available={m05Layer?.available !== false}
          />
          {/* Arrow */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 var(--space-xs)", color: "var(--color-mute)", fontSize: 20, fontWeight: "bold", flexShrink: 0 }}>
            +
          </div>
          <FusionBlock
            label="M0.6 Statistical"
            layer={m06Layer}
            weight={configuredWeights.m06 ?? configuredWeights.models}
            score={m06Layer?.score}
            available={m06Layer?.available !== false}
          />
          {/* Arrow to fused */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 var(--space-xs)", color: "var(--color-signal-teal)", fontSize: 20, flexShrink: 0 }}>
            →
          </div>
          <div style={{
            flex: 1, minWidth: 100,
            background: scoreColor === "var(--color-mute)" ? "var(--color-canvas)" : `color-mix(in srgb, ${scoreColor} 8%, var(--color-canvas))`,
            border: `2px solid ${scoreColor}`,
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-md)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "var(--space-xs)" }}>
              Fused Score
            </div>
            <div style={{ fontFamily: "var(--font-code)", fontSize: "22px", fontWeight: "var(--weight-semibold)", color: scoreColor, lineHeight: 1.2 }}>
              {score != null ? score.toFixed(1) : "—"}
            </div>
            <div style={{ marginTop: "var(--space-xs)" }}>
              <RiskLevelBadge level={riskData?.risk_level} />
            </div>
          </div>
        </div>

        {/* Fusion weights table */}
        {weightRows.length > 0 && (
          <div style={{ marginTop: "var(--space-md)", borderTop: "1px solid var(--color-hairline)", paddingTop: "var(--space-md)" }}>
            <DataTable
              rows={weightRows}
              columns={[
                { key: "layer", header: "Layer" },
                { key: "configured", header: "Configured Weight", render: (row) => formatValue(row.configured) },
                { key: "effective", header: "Effective Weight", render: (row) => formatValue(row.effective) },
              ]}
            />
          </div>
        )}
      </Panel>

      {/* Layer Contributions chart */}
      <Panel label="Layer Contributions">
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", marginBottom: "var(--space-md)" }}>
          M0.5 deterministic intelligence and M0.6 statistical models contributing to this risk record.
        </div>
        <ContributionBars analyticalEvidence={analytical} height={110} />
      </Panel>

      {/* Risk Timeline */}
      <Panel label="Risk History">
        <RiskChart
          records={riskTimeline}
          height={220}
          selectedTimestamp={ts || simulationState?.current_sim_time}
        />
      </Panel>
    </div>
  );
}
