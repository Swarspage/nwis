/**
 * Models — M0.6 Statistical Model Evidence Workstation.
 *
 * Visual hierarchy:
 *   1. Architecture header: 3 model cards (isolation_forest | kmeans | temporal_deviation)
 *   2. Model Comparison chart — side-by-side anomaly scores
 *      Color rule: ink/slate by default. Risk semantics ONLY when API provides risk_level.
 *   3. M0.8 Fusion display — actual weights from API
 *   4. Feature Contributions chart (ModelFeatureChart)
 *   5. Evidence detail table
 *   6. Prototype Supervised — visually isolated, prominently labelled NOT VALIDATED
 *
 * Cross-panel:
 *   - Responds to focusContext.driver → highlights contributing model card
 *   - Click model card → sets focusContext.evidence (Intelligence highlights evidence)
 *
 * Live polling follows global simulation state.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client.js";

import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import { useFocusContext, useFocusKeyHandler, FocusBanner, FOCUS_TYPES } from "../components/ui/FocusContext.jsx";
import ModelFeatureChart from "../components/charts/ModelFeatureChart.jsx";
import ModelEvidence from "../components/dashboard/ModelEvidence.jsx";
import Panel from "../components/ui/Panel.jsx";
import LiveBadge from "../components/ui/LiveBadge.jsx";
import DataQualityBadge from "../components/ui/DataQualityBadge.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, latest, modelDisplayName, safeArray, titleize } from "../utils/format.js";

// M0.6 model metadata — role descriptions aligned with actual architecture
const MODEL_META = {
  isolation_forest: {
    role: "Unsupervised Anomaly",
    description: "Isolation Forest — detects statistical outliers in multi-dimensional feature space without labelled training data.",
    icon: "◎",
  },
  kmeans: {
    role: "Behavioural State",
    description: "K-Means Clustering — identifies departure from established normal behavioural clusters.",
    icon: "◈",
  },
  temporal_deviation: {
    role: "Temporal Deviation",
    description: "Temporal Deviation — detects departure from expected time-series patterns using rolling window baselines.",
    icon: "◷",
  },
};

function getModelMeta(modelName) {
  const key = (modelName || "").toLowerCase().replace(/[^a-z_]/g, "");
  return MODEL_META[key] || { role: modelDisplayName(modelName), description: null, icon: "◧" };
}

function ModelArchCard({ record, focused, onClick }) {
  const meta = getModelMeta(record.model_name);
  const score = record.anomaly_score ?? null;
  const state = record.behavioral_state ?? null;
  // Color rule: use ink unless risk_level is provided by the API
  const scoreColor =
    record.risk_level
      ? record.risk_level.toUpperCase() === "ELEVATED"
        ? "var(--color-rust)"
        : record.risk_level.toUpperCase() === "WATCH"
        ? "var(--color-brass)"
        : "var(--color-moss)"
      : "var(--color-ink)";

  return (
    <div
      onClick={onClick}
      className="card-interactive"
      style={{
        background: focused ? "var(--color-signal-teal-soft)" : "var(--color-surface-sunken)",
        border: `1px solid ${focused ? "var(--color-signal-teal)" : "var(--color-hairline)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-md)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "100%",
      }}
    >
      {/* Icon + role */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 18, color: "var(--color-signal-teal)" }}>{meta.icon}</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-signal-teal)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {meta.role}
        </span>
      </div>

      {/* Model name */}
      <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)" }}>
        {modelDisplayName(record.model_name)}
      </div>

      {/* Description */}
      {meta.description && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-body)", margin: 0, lineHeight: 1.4 }}>
          {meta.description}
        </p>
      )}

      {/* Score */}
      {score != null && (
        <div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-mute)", marginBottom: 2 }}>Anomaly Score</div>
          <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-lg)", fontWeight: "var(--weight-medium)", color: scoreColor }}>
            {score.toFixed(3)}
          </div>
          {/* Note: color is ink by default, not risk-semantic, unless API provides risk_level */}
          {!record.risk_level && (
            <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-mute)", marginTop: 2, fontStyle: "italic" }}>
              No risk interpretation from API
            </div>
          )}
        </div>
      )}

      {/* Behavioral state */}
      {state && (
        <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-mute)" }}>
          {state}
        </div>
      )}
    </div>
  );
}

export default function Models() {
  const { simulationMode, selectedTimestamp, selectedWell, simulationState } = useAppState();
  const { focus, isFocused, isTypeFocused, focusContext } = useFocusContext();
  useFocusKeyHandler();

  const isLive =
    simulationState?.mode === "LIVE_SIMULATION" &&
    simulationState?.status === "PLAYING";
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

  const chartHeight = Math.max(180, Math.min(400, evidenceRows.length * 22 + 40));

  // Cross-panel: focus.driver from Risk page highlights models that have that feature in evidence
  const focusedDriverKey = isTypeFocused(FOCUS_TYPES.DRIVER) ? focusContext?.key : null;
  const isModelFocused = (record) => {
    if (!focusedDriverKey) return false;
    return safeArray(record.evidence).some((e) => (e.feature || "").includes(focusedDriverKey));
  };

  // Fusion weights from risk API
  const fusion = risk.data?.analytical_evidence?.fusion_metadata || {};
  const configuredWeights = fusion.configured_weights || {};

  // Prototype supervised
  const prototype = risk.data?.prototype_supervised;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="page"
      style={{ gap: "14px" }}
    >

      {/* Page header */}
      <div style={{ marginBottom: "var(--space-sm)" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          M0.6 Statistical Models · {selectedWell}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap", marginTop: 4 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-xl)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)", margin: 0, letterSpacing: "var(--tracking-display-xl)" }}>
            Model Evidence
          </h1>
          {isLive && <LiveBadge />}
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-md)", color: "var(--color-body)", margin: "var(--space-xs) 0 0", lineHeight: "var(--leading-body-md)" }}>
          M0.6 ensemble: {currentRecords.length} active model{currentRecords.length !== 1 ? "s" : ""} · {formatTimestamp(currentTimestamp)}
        </p>
      </div>

      <FocusBanner />

      {/* Model Architecture Cards */}
      {currentRecords.length > 0 && (
        <Panel
          label="Active Models"
          headerRight={
            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)" }}>
              Click a model to set cross-panel focus
            </span>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-md)" }}>
            {currentRecords.map((rec, i) => {
              const focused = isModelFocused(rec) || isFocused(FOCUS_TYPES.EVIDENCE, rec.model_name);
              return (
                <ModelArchCard
                  key={i}
                  record={rec}
                  focused={focused}
                  onClick={() => {
                    const key = safeArray(rec.evidence)[0]?.feature || rec.model_name;
                    const label = modelDisplayName(rec.model_name);
                    focus(FOCUS_TYPES.EVIDENCE, key, label);
                  }}
                />
              );
            })}
          </div>
        </Panel>
      )}

      {/* M0.8 Contribution — actual weights from API */}
      {(configuredWeights.m05 != null || configuredWeights.m06 != null || configuredWeights.intelligence != null || configuredWeights.models != null) && (
        <Panel label="M0.8 Fusion Contribution">
          <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", margin: "0 0 var(--space-md)", lineHeight: "var(--leading-body-sm)" }}>
            The M0.6 statistical model layer contributes to the fused risk score alongside M0.5 deterministic intelligence.
            Weights below are from analytical_evidence.fusion_metadata.
          </p>
          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
            {[
              { key: "m05", fallback: "intelligence", label: "M0.5 Deterministic" },
              { key: "m06", fallback: "models", label: "M0.6 Statistical (this layer)" },
            ].map(({ key, fallback, label }) => {
              const w = configuredWeights[key] ?? configuredWeights[fallback];
              if (w == null) return null;
              const pct = (w * 100).toFixed(0);
              return (
                <div key={key} style={{
                  background: "var(--color-canvas)",
                  border: "1px solid var(--color-hairline)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 16px",
                  minWidth: 160,
                }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: "22px", fontWeight: "var(--weight-medium)", color: "var(--color-ink)" }}>{pct}%</div>
                  <div style={{ height: 4, background: "var(--color-hairline)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-signal-teal)", borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Feature Contributions chart */}
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

      {/* Prototype Supervised — isolated, clearly NOT VALIDATED */}
      {prototype && (
        <div style={{
          marginTop: "var(--space-md)",
          borderRadius: "var(--radius-lg)",
          border: "2px dashed var(--color-hairline-strong)",
          background: "var(--color-canvas-deep)",
          padding: "var(--space-lg)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap", marginBottom: "var(--space-md)" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Experimental Prototype
            </span>
            <DataQualityBadge status="prototype" label="Prototype Only" />
            <DataQualityBadge status="not_validated" label="Not Real-World Validated" />
            <DataQualityBadge status="synthetic" label="Not Used in Risk Score" />
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-heading-md)", fontWeight: "var(--weight-medium)", color: "var(--color-slate)", marginBottom: "var(--space-xs)" }}>
            Supervised Prototype
          </div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", margin: "0 0 var(--space-md)", lineHeight: "var(--leading-body-sm)", maxWidth: 560 }}>
            {prototype.note || "This is an experimental supervised prototype. It is NOT included in the M0.8 risk score calculation. It has NOT been validated against real-world drilling outcomes."}
          </p>
          {prototype.label && (
            <div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", marginBottom: 2 }}>Label</div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-ink)" }}>{prototype.label}</div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

