/**
 * Models — M0.6 Statistical Model Evidence Workstation.
 *
 * Visual hierarchy:
 *   1. Header: prototype label + model count + timestamp
 *   2. ModelFeatureChart — feature contribution magnitudes (per-model horizontal bars)
 *   3. Per-model summary cards (model name + anomaly_score + behavioral_state)
 *   4. Evidence rows table (detailed values)
 *
 * Live polling follows global simulation state.
 */
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import ModelFeatureChart from "../components/charts/ModelFeatureChart.jsx";
import ModelEvidence from "../components/dashboard/ModelEvidence.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, latest, modelDisplayName, safeArray, titleize } from "../utils/format.js";

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

// Small card per model showing key scalars
function ModelCard({ record }) {
  const name = modelDisplayName(record.model_name);
  const score = record.anomaly_score ?? null;
  const state = record.behavioral_state ?? null;
  const scoreColor =
    score == null ? "var(--color-mute)"
    : score >= 0.7 ? "var(--color-rust)"
    : score >= 0.4 ? "var(--color-brass)"
    : "var(--color-moss)";

  return (
    <div
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
          marginBottom: "var(--space-xs)",
        }}
      >
        {name}
      </div>
      {score != null && (
        <div
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-data-lg)",
            fontWeight: "var(--weight-medium)",
            color: scoreColor,
            lineHeight: 1.2,
          }}
        >
          {score.toFixed(3)}
        </div>
      )}
      {state && (
        <div
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-data-sm)",
            color: "var(--color-mute)",
            marginTop: 4,
          }}
        >
          {state}
        </div>
      )}
    </div>
  );
}

export default function Models() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const isLive = simulationState?.mode === "LIVE_SIMULATION" && simulationState?.status === "PLAYING";
  const pollMs = isLive ? 2000 : 0;
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

  const models = useApiResource(
    () => api.models(ts ? { timestamp: ts, limit: 153 } : { limit: 153 }, selectedWell),
    [ts, selectedWell],
    pollMs
  );
  const risk = useApiResource(
    () => (ts ? api.riskAt(ts, selectedWell) : api.currentRisk(selectedWell)),
    [ts, selectedWell],
    pollMs
  );

  if (models.state === "loading" || risk.state === "loading") return <LoadingState lines={5} />;
  if (models.state === "error") return <ErrorState error={models.error} />;
  if (risk.state === "error") return <ErrorState error={risk.error} />;

  const records = models.data?.records || [];
  const currentTimestamp = risk.data?.timestamp || latest(records)?.timestamp;
  const currentRecords = records.filter((r) => r.timestamp === currentTimestamp);

  const evidenceRows = currentRecords.flatMap((record) =>
    safeArray(record.evidence).map((item, idx) => ({
      id: `${record.model_name}-${idx}`,
      model: modelDisplayName(record.model_name),
      ...item,
    }))
  );

  // Chart height scales with number of evidence items, min 180
  const chartHeight = Math.max(180, Math.min(400, evidenceRows.length * 22 + 40));

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
          M0.6 Statistical Models · {selectedWell}
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
            Models
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

      {/* Per-model summary cards */}
      {currentRecords.length > 0 && (
        <Panel
          label="Model Summaries"
          headerRight={
            <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
              {formatTimestamp(currentTimestamp)}
            </span>
          }
        >
          <div className="card-grid">
            {currentRecords.map((rec, i) => (
              <div key={i} className="span-4">
                <ModelCard record={rec} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Feature contribution chart */}
      <Panel
        label="Feature Contributions"
        headerRight={
          <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)" }}>
            Top evidence by magnitude · color = direction
          </span>
        }
      >
        <ModelFeatureChart records={currentRecords} height={chartHeight} />
      </Panel>

      {/* ModelEvidence (existing component) */}
      <ModelEvidence records={currentRecords} prototype={risk.data?.prototype_supervised} />

      {/* Evidence rows table */}
      {evidenceRows.length > 0 && (
        <Panel label="Evidence Detail">
          <DataTable
            rows={evidenceRows}
            columns={[
              { key: "model", header: "Model" },
              { key: "feature", header: "Feature", render: (row) => titleize(row.feature) },
              { key: "contribution", header: "Contribution" },
              { key: "direction", header: "Direction", render: (row) => titleize(row.direction) },
            ]}
            empty="No evidence rows returned for the current model records."
          />
        </Panel>
      )}
    </div>
  );
}
