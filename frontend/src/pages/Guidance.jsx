import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAppState } from "../app/AppState.jsx";
import { useApiResource } from "../api/hooks.js";
import { api } from "../api/client.js";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import TelemetryChart from "../components/charts/TelemetryChart.jsx";
import RiskLevelBadge from "../components/ui/RiskLevelBadge.jsx";
import { formatTimestamp, titleize } from "../utils/format.js";
import {
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineArrowRight,
  HiOutlineDocumentCheck,
  HiOutlineClock,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineShieldExclamation,
  HiOutlineCpuChip,
  HiOutlineChartBar
} from "react-icons/hi2";

const ATTENTION_LEVEL_COLORS = {
  INFORMATION: { bg: "#EBF5F5", text: "#1E8A8A", border: "#BCE3E3" },
  MONITOR: { bg: "#FFF8E6", text: "#B7791F", border: "#FEEBC8" },
  REVIEW: { bg: "#FFFAF0", text: "#DD6B20", border: "#FBD38D" },
  INVESTIGATE: { bg: "#FFF5F5", text: "#E53E3E", border: "#FEB2B2" },
  ESCALATE: { bg: "#9B2C2C", text: "#FFFFFF", border: "#742A2A" },
  INSUFFICIENT_EVIDENCE: { bg: "#F7FAFC", text: "#718096", border: "#E2E8F0" }
};

const TELEMETRY_FIELDS = [
  { key: "torque", label: "Torque" },
  { key: "hookload", label: "Hookload" },
  { key: "standpipe_pressure", label: "SPP" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } }
};

export default function Guidance() {
  const navigate = useNavigate();
  const { selectedWell, selectedTimestamp, simulationMode, setFocusContext, simulationState } = useAppState();
  const isReplay = simulationMode === "replay";
  const isLive = simulationState?.mode === "LIVE_SIMULATION" && simulationState?.status === "PLAYING";
  const ts = isReplay ? selectedTimestamp : null;

  const [expandedEvidence, setExpandedEvidence] = useState(false);

  const guidanceRes = useApiResource(
    () => (ts ? api.guidanceAt(ts, selectedWell) : api.currentGuidance(selectedWell)),
    [ts, selectedWell],
    1000
  );

  const riskRes = useApiResource(
    () => (ts ? api.riskAt(ts, selectedWell) : api.currentRisk(selectedWell)),
    [ts, selectedWell],
    1000
  );

  const telemetryRes = useApiResource(
    () => api.telemetry(ts ? { timestamp: ts, limit: 30 } : { limit: 30 }, selectedWell),
    [ts, selectedWell],
    1000
  );

  const historicalRes = useApiResource(
    () => (ts ? api.historicalContext(ts, selectedWell).catch(() => null) : api.historicalEvents(selectedWell).catch(() => null)),
    [ts, selectedWell]
  );

  if (guidanceRes.state === "loading") return <LoadingState lines={8} />;
  if (guidanceRes.state === "error") return <ErrorState error={guidanceRes.error} />;

  const g = guidanceRes.data || {};
  const risk = riskRes.data || {};
  const telemetryRecords = telemetryRes.data?.records || [];
  const levelStyle = ATTENTION_LEVEL_COLORS[g.guidance_level] || ATTENTION_LEVEL_COLORS.INFORMATION;

  // Compute Data Completeness Metric
  const totalChannels = (g.available_parameters?.length || 0) + (g.unavailable_parameters?.length || 0);
  const completenessPct = totalChannels > 0 ? Math.round(((g.available_parameters?.length || 0) / totalChannels) * 100) : 100;

  // Compute Evidence Strength Indicator
  const maxZScore = Math.max(0, ...(g.primary_evidence || []).map((p) => Math.abs(p.z_score || 0)));
  const evidenceStrengthPct = Math.min(100, Math.round((maxZScore / 4.0) * 100));

  const handleStepClick = (stepText) => {
    const lower = stepText.toLowerCase();
    if (lower.includes("telemetry") || lower.includes("torque") || lower.includes("hookload") || lower.includes("spp") || lower.includes("pressure")) {
      navigate("/telemetry");
    } else if (lower.includes("model") || lower.includes("m0.6")) {
      navigate("/models");
    } else if (lower.includes("m0.5") || lower.includes("intelligence")) {
      navigate("/intelligence");
    } else {
      navigate("/telemetry");
    }
  };

  const handleFocusEvidence = (item) => {
    setFocusContext({ feature: item.evidence, timestamp: g.timestamp, wellId: selectedWell });
  };

  return (
    <div className="page" style={{ gap: "14px" }}>
      {/* SECTION 1: CURRENT SITUATION (REDUCED VERTICAL PADDING) */}
      <div
        style={{
          background: "var(--color-surface, #FFFFFF)",
          border: "1px solid var(--color-hairline, #DFE6E3)",
          borderRadius: "var(--radius-lg, 14px)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
          boxShadow: "0 2px 8px rgba(10, 37, 64, 0.03)"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontFamily: "var(--font-code)",
                fontSize: "18px",
                fontWeight: "700",
                color: "var(--color-ink, #0A2540)"
              }}
            >
              {selectedWell}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                padding: "2px 8px",
                borderRadius: "12px",
                background: isReplay ? "#EBF4FF" : "#E6FFFA",
                color: isReplay ? "#3182CE" : "#319795",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              {isLive && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#319795",
                    animation: "livePulse 1.8s ease-in-out infinite"
                  }}
                />
              )}
              {isReplay ? "REPLAY MODE" : "LIVE SIMULATION"}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-body, #5B6B7A)", marginTop: "2px" }}>
            Current Situation • {formatTimestamp(g.timestamp) || "Latest Snapshot"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          {/* Risk Level Badge */}
          <div>
            <div style={{ fontSize: "10px", color: "var(--color-body, #5B6B7A)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Risk Level (M0.8)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
              <motion.span
                key={risk.risk_score}
                initial={{ opacity: 0.5, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ fontFamily: "var(--font-code)", fontSize: "15px", fontWeight: "700", color: "var(--color-ink, #0A2540)" }}
              >
                {risk.risk_score != null ? `${risk.risk_score.toFixed(1)}` : "—"}
              </motion.span>
              <RiskLevelBadge level={risk.risk_level || "NORMAL"} />
            </div>
          </div>

          <div style={{ width: "1px", height: "26px", background: "var(--color-hairline, #DFE6E3)" }} />

          {/* Engineering Attention Badge */}
          <div>
            <div style={{ fontSize: "10px", color: "var(--color-body, #5B6B7A)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              ENGINEERING ATTENTION
            </div>
            <motion.span
              key={g.guidance_level}
              initial={{ opacity: 0.6, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: "inline-block",
                fontSize: "11px",
                fontWeight: "700",
                padding: "3px 10px",
                borderRadius: "14px",
                background: levelStyle.bg,
                color: levelStyle.text,
                border: `1px solid ${levelStyle.border}`,
                marginTop: "2px"
              }}
            >
              {g.guidance_level}
            </motion.span>
          </div>
        </div>
      </div>

      {/* SECTION 2: ENGINEERING ATTENTION (COMPACT PRIMARY CARD) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={g.rule_id || g.guidance_level}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            background: "var(--color-surface, #FFFFFF)",
            border: `1.5px solid ${levelStyle.border}`,
            borderRadius: "var(--radius-lg, 14px)",
            padding: "18px 20px",
            boxShadow: "0 3px 16px rgba(10, 37, 64, 0.04)"
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: levelStyle.bg,
                color: levelStyle.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                flexShrink: 0
              }}
            >
              {g.guidance_level === "INFORMATION" ? <HiOutlineCheckCircle /> : <HiOutlineExclamationTriangle />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.8px", color: levelStyle.text }}>
                ENGINEERING ATTENTION
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-ink, #0A2540)", margin: "2px 0 6px" }}>
                {g.title}
              </h2>
              <p style={{ fontSize: "13px", lineHeight: "1.5", color: "var(--color-body, #3E5164)", margin: 0 }}>
                {g.summary}
              </p>

              {/* Mini Telemetry Trend Sparkline */}
              {telemetryRecords.length > 0 && (
                <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--color-hairline, #DFE6E3)" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--color-body, #5B6B7A)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                    Recent Telemetry Trend (Mini Overview)
                  </div>
                  <div style={{ height: "215px", width: "100%", background: "#FAFCFC", borderRadius: "6px", padding: "10px 8px", border: "1px solid #EDF2F7" }}>
                    <TelemetryChart records={telemetryRecords} fields={TELEMETRY_FIELDS} height={195} compact />
                  </div>


                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* SECTION 3 & 4 GRID: WHY THIS GUIDANCE & REVIEW PARAMETERS */}
      <div className="card-grid" style={{ alignItems: "stretch", gap: "14px" }}>
        {/* SECTION 3: WHY THIS GUIDANCE? */}
        <div className="span-7" style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              background: "var(--color-surface, #FFFFFF)",
              border: "1px solid var(--color-hairline, #DFE6E3)",
              borderRadius: "var(--radius-lg, 14px)",
              padding: "16px",
              flex: 1,
              boxShadow: "0 2px 8px rgba(10, 37, 64, 0.03)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-ink, #0A2540)", margin: 0 }}>
                Why this guidance? (Evidence Chain)
              </h3>
              <button
                onClick={() => setExpandedEvidence(!expandedEvidence)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-signal-teal, #1E8A8A)",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px"
                }}
              >
                {expandedEvidence ? "Hide Drawer" : "Expand Drawer"} {expandedEvidence ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
              </button>
            </div>

            {/* Evidence Strength Visualization Bar */}
            <div style={{ marginBottom: "12px", background: "#F8FAFC", padding: "8px 12px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "600", color: "#4A5568", marginBottom: "4px" }}>
                <span>Evidence Anomaly Strength</span>
                <span>{evidenceStrengthPct}% (Max Z: {maxZScore.toFixed(1)})</span>
              </div>
              <div style={{ height: "4px", background: "#E2E8F0", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${evidenceStrengthPct}%`, background: evidenceStrengthPct > 60 ? "#DD6B20" : "#319795", transition: "width 0.3s ease" }} />
              </div>
            </div>

            {g.basis && g.basis.length > 0 ? (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {g.basis.map((item, idx) => (
                  <motion.div
                    key={idx}
                    variants={itemVariants}
                    onClick={() => handleFocusEvidence(item)}
                    whileHover={{ scale: 1.008, backgroundColor: "#F1F5F9" }}
                    whileTap={{ scale: 0.995 }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-hairline, #E2E8F0)",
                      background: "#F8FAFC",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "10px", fontWeight: "700", background: "#0A2540", color: "#FFFFFF", padding: "1px 5px", borderRadius: "3px" }}>
                          {item.source}
                        </span>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--color-ink, #0A2540)" }}>
                          {item.evidence}
                        </span>
                        <span style={{ fontSize: "9px", color: "#718096", background: "#EDF2F7", padding: "1px 5px", borderRadius: "3px" }}>
                          {item.semantics || "DERIVED_ANALYTICAL"}
                        </span>
                      </div>
                      <Link to="/intelligence" style={{ color: "var(--color-signal-teal, #1E8A8A)", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                        Inspect <HiOutlineArrowRight />
                      </Link>
                    </div>

                    {item.details && (
                      <div style={{ fontSize: "11px", color: "var(--color-body, #5B6B7A)" }}>
                        {item.details}
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Expandable Drawer */}
                <AnimatePresence>
                  {expandedEvidence && g.primary_evidence && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: "hidden", marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #E2E8F0" }}
                    >
                      <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--color-body, #5B6B7A)", textTransform: "uppercase", marginBottom: "4px" }}>
                        Primary Feature Contribution Breakdown
                      </div>
                      {g.primary_evidence.map((p, pIdx) => (
                        <div key={pIdx} style={{ fontSize: "11px", padding: "4px 8px", background: "#EDF2F7", borderRadius: "4px", marginBottom: "3px", display: "flex", justifyContent: "space-between" }}>
                          <span><strong>{p.feature}</strong> ({p.direction || "ANOMALOUS"})</span>
                          <span>Z: <strong>{p.z_score != null ? p.z_score : "—"}</strong> | Contrib: <strong>{p.contribution != null ? (p.contribution * 100).toFixed(1) + "%" : "—"}</strong></span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div style={{ fontSize: "12px", color: "var(--color-body, #5B6B7A)", fontStyle: "italic" }}>
                No active anomaly evidence flagged for this condition.
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: REVIEW PARAMETERS */}
        <div className="span-5" style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              background: "var(--color-surface, #FFFFFF)",
              border: "1px solid var(--color-hairline, #DFE6E3)",
              borderRadius: "var(--radius-lg, 14px)",
              padding: "16px",
              flex: 1,
              boxShadow: "0 2px 8px rgba(10, 37, 64, 0.03)"
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-ink, #0A2540)", marginBottom: "10px" }}>
              Review Parameters & Data Quality
            </h3>

            {/* Data Completeness Progress Bar */}
            <div style={{ marginBottom: "12px", background: "#F8FAFC", padding: "8px 12px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "600", color: "#4A5568", marginBottom: "4px" }}>
                <span>Data Completeness</span>
                <span>{g.available_parameters?.length || 0} / {totalChannels} Channels ({completenessPct}%)</span>
              </div>
              <div style={{ height: "4px", background: "#E2E8F0", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${completenessPct}%`, background: completenessPct >= 80 ? "#319795" : "#DD6B20", transition: "width 0.3s ease" }} />
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--color-body, #5B6B7A)", marginBottom: "6px", textTransform: "uppercase" }}>
                SUPPORTING PARAMETERS (AVAILABLE)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {g.supporting_parameters && g.supporting_parameters.length > 0 ? (
                  g.supporting_parameters.map((item) => (
                    <motion.span
                      key={item.parameter}
                      whileHover={{ scale: 1.03 }}
                      style={{ fontSize: "11px", fontWeight: "500", background: "#E6FFFA", color: "#234E52", padding: "3px 8px", borderRadius: "10px", border: "1px solid #B2F5EA", display: "inline-flex", alignItems: "center", gap: "3px" }}
                    >
                      <HiOutlineCheckCircle style={{ color: "#319795" }} /> {titleize(item.parameter)}: <strong>{item.value}</strong>
                    </motion.span>
                  ))
                ) : (
                  <span style={{ fontSize: "11px", color: "#A0AEC0" }}>None available</span>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--color-body, #5B6B7A)", marginBottom: "6px", textTransform: "uppercase" }}>
                DATA GAPS (MISSING / UNINGESTED)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {g.data_gaps && g.data_gaps.length > 0 ? (
                  g.data_gaps.map((item) => (
                    <span
                      key={item.parameter}
                      title={item.reason}
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        background: "#F1F5F9",
                        color: "#475569",
                        padding: "3px 8px",
                        borderRadius: "10px",
                        border: "1px dashed #CBD5E1",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px"
                      }}
                    >
                      <HiOutlineXCircle style={{ color: "#94A3B8" }} /> {titleize(item.parameter)}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: "11px", color: "#319795" }}>All parameters available</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: RECOMMENDED REVIEW PATH */}
      <div
        style={{
          background: "var(--color-surface, #FFFFFF)",
          border: "1px solid var(--color-hairline, #DFE6E3)",
          borderRadius: "var(--radius-lg, 14px)",
          padding: "18px 20px",
          boxShadow: "0 2px 8px rgba(10, 37, 64, 0.03)"
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--color-ink, #0A2540)", marginBottom: "12px" }}>
          Recommended Review Path (Interactive Decision-Support Workflow)
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {g.recommended_review_path && g.recommended_review_path.length > 0 ? (
            g.recommended_review_path.map((step, idx) => (
              <motion.div
                key={idx}
                onClick={() => handleStepClick(step)}
                whileHover={{ x: 4, backgroundColor: "#F1F5F9", borderColor: "var(--color-signal-teal, #1E8A8A)" }}
                whileTap={{ scale: 0.995 }}
                title="Click step to navigate to target analytics view"
                style={{
                  padding: "10px 14px",
                  borderRadius: "6px",
                  background: "#F7FAFC",
                  borderLeft: "4px solid var(--color-signal-teal, #1E8A8A)",
                  borderTop: "1px solid #EDF2F7",
                  borderRight: "1px solid #EDF2F7",
                  borderBottom: "1px solid #EDF2F7",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--color-ink, #0A2540)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease, border-color 0.15s ease"
                }}
              >
                <span>{step}</span>
                <span style={{ fontSize: "11px", color: "var(--color-signal-teal, #1E8A8A)", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  Navigate <HiOutlineArrowRight />
                </span>
              </motion.div>
            ))
          ) : (
            <div style={{ fontSize: "12px", color: "var(--color-body, #5B6B7A)" }}>
              1. Continue routine operational monitoring.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 6 & 7 GRID: HISTORICAL SUPPORT & PROVENANCE / LIMITATIONS */}
      <div className="card-grid" style={{ alignItems: "stretch", gap: "14px" }}>
        {/* SECTION 6: HISTORICAL SUPPORT */}
        <div className="span-6" style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              background: "var(--color-surface, #FFFFFF)",
              border: "1px solid var(--color-hairline, #DFE6E3)",
              borderRadius: "var(--radius-lg, 14px)",
              padding: "16px",
              flex: 1,
              boxShadow: "0 2px 8px rgba(10, 37, 64, 0.03)"
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-ink, #0A2540)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <HiOutlineClock /> Historical Offset Support (M0.7)
            </h3>
            {historicalRes.data?.available ? (
              <div style={{ padding: "10px 12px", background: "#FEFCBF", color: "#744210", borderRadius: "6px", fontSize: "12px" }}>
                Confirmed Historical Event Context Available for this timestamp.
                <div style={{ marginTop: "6px" }}>
                  <Link to="/historical" style={{ fontWeight: "700", color: "#744210", textDecoration: "underline" }}>
                    View M0.7 Historical Event Details →
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "6px", border: "1px dashed #CBD5E0" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#4A5568" }}>
                  No Verified Historical Offset Event
                </div>
                <div style={{ fontSize: "11px", color: "var(--color-body, #5B6B7A)", marginTop: "4px", lineHeight: "1.4" }}>
                  No verified historical offset event is recorded for this timestamp interval in the M0.7 knowledge repository. Guidance is derived strictly from analytical telemetry baselines.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 7: GUIDANCE LIMITATIONS & STRUCTURED PROVENANCE METADATA GRID */}
        <div className="span-6" style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              background: "var(--color-surface, #FFFFFF)",
              border: "1px solid var(--color-hairline, #DFE6E3)",
              borderRadius: "var(--radius-lg, 14px)",
              padding: "16px",
              flex: 1,
              boxShadow: "0 2px 8px rgba(10, 37, 64, 0.03)"
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-ink, #0A2540)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <HiOutlineDocumentCheck /> Guidance Provenance & Limitations
            </h3>
            
            {/* Structured Provenance Metadata Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", marginBottom: "10px" }}>
              <div style={{ background: "#F8FAFC", padding: "6px 10px", borderRadius: "6px", border: "1px solid #EDF2F7" }}>
                <div style={{ color: "#718096", fontSize: "10px", textTransform: "uppercase" }}>Provenance Type</div>
                <div style={{ fontWeight: "700", color: "#2D3748", marginTop: "2px" }}>{g.provenance?.type || "ENGINEERING_HEURISTIC"}</div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "6px 10px", borderRadius: "6px", border: "1px solid #EDF2F7" }}>
                <div style={{ color: "#718096", fontSize: "10px", textTransform: "uppercase" }}>Rule Source</div>
                <div style={{ fontFamily: "var(--font-code)", fontWeight: "600", color: "#2D3748", marginTop: "2px" }}>{g.rule_id}</div>
              </div>

              <div style={{ gridColumn: "span 2", background: "#FFF5F5", padding: "6px 10px", borderRadius: "6px", border: "1px solid #FEB2B2" }}>
                <div style={{ color: "#9B2C2C", fontSize: "10px", textTransform: "uppercase", fontWeight: "700" }}>Validation Status</div>
                <div style={{ color: "#C53030", fontWeight: "700", marginTop: "2px" }}>{g.provenance?.validation_status || "NOT_OPERATIONALLY_VALIDATED"}</div>
              </div>
            </div>

            <div style={{ padding: "8px 10px", background: "#FAFCFC", borderRadius: "6px", border: "1px solid #E2E8F0", fontSize: "11px", fontStyle: "italic", color: "#4A5568" }}>
              {g.limitations && g.limitations.length > 0 ? g.limitations[0] : "Operational parameter changes are not prescribed by the current NWIS guidance layer."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
