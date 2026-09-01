/**
 * Intelligence — M0.5 Anomaly & Rule View.
 *
 * Visual hierarchy:
 *   1. Hero metrics: anomaly_score + risk_level + confidence + status
 *   2. Anomaly score trace (AnomalyChart)
 *   3. EvidenceSummary (existing component)
 *   4. Quality flags table
 *
 * Live polling follows global simulation state.
 */
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import AnomalyChart from "../components/charts/AnomalyChart.jsx";
import EvidenceSummary from "../components/dashboard/EvidenceSummary.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatPercent, formatTimestamp, formatValue, latest, titleize } from "../utils/format.js";

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

function HeroMetric({ label, value, mono = false, color }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label-sm)",
          color: "var(--color-mute)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? "var(--font-code)" : "var(--font-body)",
          fontSize: mono ? "var(--text-data-lg)" : "var(--text-heading-sm)",
          fontWeight: "var(--weight-medium)",
          color: color || "var(--color-ink)",
          lineHeight: 1.2,
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function anomalyColor(score) {
  if (score == null) return "var(--color-mute)";
  if (score >= 0.7) return "var(--color-rust)";
  if (score >= 0.4) return "var(--color-brass)";
  return "var(--color-moss)";
}

export default function Intelligence() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const isLive = simulationState?.mode === "LIVE_SIMULATION" && simulationState?.status === "PLAYING";
  const pollMs = isLive ? 2000 : 0;
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

  const intelligence = useApiResource(
    () => api.intelligence(ts ? { timestamp: ts, limit: 120 } : { limit: 120 }, selectedWell),
    [ts, selectedWell],
    pollMs
  );

  if (intelligence.state === "loading") return <LoadingState lines={5} />;
  if (intelligence.state === "error") return <ErrorState error={intelligence.error} />;

  const records = intelligence.data?.records || [];
  const current = latest(records);
  const qualityRows = Object.entries(current?.quality_flags || {}).map(([name, value]) => ({ name, value }));
  const anomalyScore = current?.anomaly_score ?? null;

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
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-heading-md)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-ink)",
            }}
          >
            Intelligence
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
              Live
            </div>
          )}
        </div>
      </div>

      {/* Hero metrics row */}
      <Panel>
        <div style={{ display: "flex", gap: "var(--space-xl)", flexWrap: "wrap", alignItems: "flex-start" }}>
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
          <HeroMetric label="Risk Level" value={titleize(current?.risk_level)} />
          <HeroMetric label="Confidence" value={formatPercent(current?.confidence)} mono />
          <HeroMetric label="Status" value={titleize(current?.intelligence_status)} />
          <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
            <div
              style={{
                fontFamily: "var(--font-code)",
                fontSize: "var(--text-data-sm)",
                color: "var(--color-mute)",
              }}
            >
              {formatTimestamp(current?.timestamp)}
            </div>
          </div>
        </div>
      </Panel>

      {/* Anomaly score trace */}
      <Panel
        label="Anomaly Score Trace"
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
        <AnomalyChart records={records} height={200} />
      </Panel>

      {/* Evidence summary */}
      {current && <EvidenceSummary intelligence={current} />}

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
