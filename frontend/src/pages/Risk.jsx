/**
 * Risk — M0.8 Analytical Workstation
 *
 * Visual hierarchy:
 *   1. Hero: large gauge + score + level badge + explanation
 *   2. Risk history: full-width RiskChart
 *   3. Layer contributions: ContributionBars (M0.5 / M0.6)
 *   4. Fusion weights: DataTable
 *
 * Live polling is driven by global simulation state.
 */
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import RiskGauge from "../components/charts/RiskGauge.jsx";
import RiskChart from "../components/charts/RiskChart.jsx";
import ContributionBars from "../components/charts/ContributionBars.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatPercent, formatTimestamp, formatValue, titleize } from "../utils/format.js";

// ── Risk level badge ────────────────────────────────────────
function RiskLevelBadge({ level, score }) {
  const colorMap = {
    ELEVATED: { bg: "var(--color-rust-soft)", text: "var(--color-rust)", border: "var(--color-rust)" },
    WATCH: { bg: "var(--color-brass-soft)", text: "var(--color-brass)", border: "var(--color-brass)" },
    NORMAL: { bg: "var(--color-moss-soft)", text: "var(--color-moss)", border: "var(--color-moss)" },
  };
  const upper = (level || "").toUpperCase();
  const c = colorMap[upper] || { bg: "var(--color-canvas)", text: "var(--color-mute)", border: "var(--color-hairline)" };
  return (
    <span
      style={{
        display: "inline-block",
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-label-sm)",
        fontWeight: "var(--weight-medium)",
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        letterSpacing: "0.03em",
      }}
    >
      {titleize(level) || "—"}
    </span>
  );
}

// ── Section panel ───────────────────────────────────────────
function Panel({ label, children }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-hairline)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
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
            marginBottom: "var(--space-md)",
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Live badge ──────────────────────────────────────────────
function LiveBadge() {
  return (
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
      Live
    </div>
  );
}

export default function Risk() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const isLive = simulationState?.mode === "LIVE_SIMULATION" && simulationState?.status === "PLAYING";
  const pollMs = isLive ? 2000 : 0;
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

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
  const riskColor =
    score == null ? "var(--color-mute)"
    : score >= 70 ? "var(--color-rust)"
    : score >= 40 ? "var(--color-brass)"
    : "var(--color-moss)";

  const analytical = riskData?.analytical_evidence || {};
  const fusion = analytical.fusion_metadata || {};
  const weightRows = Object.entries(fusion.configured_weights || {}).map(([layer, configured]) => ({
    layer: layer.toUpperCase(),
    configured,
    effective: fusion.effective_weights?.[layer],
  }));

  const riskTimeline = timeline.data?.records || [];

  return (
    <div className="page">
      {/* Page header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
          marginBottom: "var(--space-md)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-label-sm)",
              color: "var(--color-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            M0.8 Risk Fusion · {selectedWell}
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-heading-md)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-ink)",
              marginTop: 2,
            }}
          >
            Risk Analysis
          </div>
        </div>
        {isLive && <LiveBadge />}
      </div>

      {/* Hero: gauge + score */}
      <Panel>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-xl)", flexWrap: "wrap" }}>
          <RiskGauge score={score} size={200} />
          <div style={{ flex: 1, minWidth: 180, paddingTop: "var(--space-md)" }}>
            <div
              style={{
                fontFamily: "var(--font-code)",
                fontSize: "var(--text-display-xl, 34px)",
                fontWeight: "var(--weight-semibold)",
                color: riskColor,
                lineHeight: 1.05,
                marginBottom: "var(--space-xs)",
              }}
            >
              {score != null ? score.toFixed(1) : "—"}
            </div>
            <div style={{ marginBottom: "var(--space-sm)" }}>
              <RiskLevelBadge level={riskData?.risk_level} score={score} />
            </div>
            {riskData?.explanation && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-body)",
                  lineHeight: "var(--leading-body-sm)",
                  margin: 0,
                  maxWidth: 420,
                }}
              >
                {riskData.explanation}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: "var(--space-lg)",
                marginTop: "var(--space-md)",
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "Alert", value: formatValue(riskData?.alert) },
                { label: "Confidence", value: formatPercent(riskData?.confidence) },
                { label: "Timestamp", value: formatTimestamp(riskData?.timestamp) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)" }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-ink)", marginTop: 2 }}>
                    {value || "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* Risk history timeline */}
      <Panel label="Risk History">
        <RiskChart records={riskTimeline} height={220} selectedTimestamp={ts || simulationState?.current_sim_time} />
      </Panel>

      {/* Layer contributions */}
      <Panel label="Layer Contributions">
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            color: "var(--color-body)",
            marginBottom: "var(--space-md)",
          }}
        >
          M0.5 deterministic intelligence and M0.6 statistical models contributing to this risk record.
        </div>
        <ContributionBars analyticalEvidence={analytical} height={110} />

        {/* Availability detail */}
        <div className="card-grid" style={{ marginTop: "var(--space-md)" }}>
          {[analytical.m05, analytical.m06].map((layer, i) =>
            layer ? (
              <div key={i} className="span-6">
                <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", marginBottom: 4 }}>
                  {i === 0 ? "M0.5 Intelligence" : "M0.6 Models"}
                </div>
                <div style={{ display: "flex", gap: "var(--space-lg)", flexWrap: "wrap" }}>
                  {[
                    { k: "Available", v: formatValue(layer.available) },
                    { k: "Level", v: titleize(layer.level) },
                    { k: "Alert", v: formatValue(layer.alert) },
                  ].map(({ k, v }) => (
                    <div key={k}>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-mute)" }}>{k}</div>
                      <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-ink)" }}>{v || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      </Panel>

      {/* Fusion weights table */}
      {weightRows.length > 0 && (
        <Panel label="Fusion Weights">
          <DataTable
            rows={weightRows}
            columns={[
              { key: "layer", header: "Layer" },
              { key: "configured", header: "Configured", render: (row) => formatValue(row.configured) },
              { key: "effective", header: "Effective", render: (row) => formatValue(row.effective) },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
