import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAppState } from "../app/AppState.jsx";
import { useFocusContext, useFocusKeyHandler, FocusBanner, FOCUS_TYPES } from "../components/ui/FocusContext.jsx";
import OffsetWellScene from "../components/visualization/OffsetWellScene.jsx";
import { WELL_COLOR_PALETTE } from "../components/visualization/geometryTransform.js";
import Panel from "../components/ui/Panel.jsx";
import LiveBadge from "../components/ui/LiveBadge.jsx";
import DataQualityBadge from "../components/ui/DataQualityBadge.jsx";
import EvidenceDrawer from "../components/ui/EvidenceDrawer.jsx";
import "../components/ui/ui.css";

export default function Offsets() {
  const navigate = useNavigate();
  const { simulationMode, selectedTimestamp, selectedWell, setSelectedWell, setSelectedTimestamp, setFocusContext, simulationState } = useAppState();
  const { focus, isFocused, clearFocus } = useFocusContext();
  useFocusKeyHandler();

  const isLive = simulationState?.mode === "LIVE_SIMULATION" && simulationState?.status === "PLAYING";
  const isSynthetic = selectedWell !== "WELL-1";
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

  const [activeGeometry, setActiveGeometry] = useState(null);
  const [offsets, setOffsets] = useState([]);
  const [offsetGeometries, setOffsetGeometries] = useState([]);
  const [intelligenceResult, setIntelligenceResult] = useState(null);
  const [lookAheadWindow, setLookAheadWindow] = useState(500);
  const [loading, setLoading] = useState(true);

  // Workspace State
  const [selectedOffsetWellId, setSelectedOffsetWellId] = useState("WELL-3");
  const [viewMode, setViewMode] = useState("PERSPECTIVE"); // "PERSPECTIVE", "TOP", "SIDE / TRAJECTORY"
  const [framingTarget, setFramingTarget] = useState("FIT_ALL"); // "FIT_ALL", "FOCUS_ACTIVE", "FOCUS_SELECTED"
  const [measurementMode, setMeasurementMode] = useState("OFF"); // "OFF", "SURFACE DISTANCE", "MINIMUM 3D SEPARATION"

  // Evidence Drawer & Inspector State
  const [targetEvidence, setTargetEvidence] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch geometry, offset relationships, and offset intelligence
  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const params = { ...(ts ? { timestamp: ts } : {}), look_ahead_window: lookAheadWindow };
        const geomData = await api.geometry(params, selectedWell);

        if (active) setActiveGeometry(geomData);

        const offsetsData = await api.offsets(params, selectedWell);
        if (active) setOffsets(offsetsData);

        try {
          const intelRes = await api.offsetIntelligence(params, selectedWell);
          if (active) setIntelligenceResult(intelRes);
        } catch (e) {
          if (active) setIntelligenceResult(null);
        }

        const geoms = [];
        for (const off of offsetsData) {
          try {
            const ogRes = await api.geometry(params, off.offset_well_id);
            geoms.push(ogRes);
          } catch (e) {}
        }
        if (active) setOffsetGeometries(geoms);
      } catch (e) {
        console.error("Offsets error", e);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => { active = false; };
  }, [selectedWell, ts, lookAheadWindow]);



  // Re-poll active geometry if live simulation is playing
  useEffect(() => {
    let interval;
    if (isLive && activeGeometry && activeGeometry.geometry_status !== "UNAVAILABLE") {
      interval = setInterval(async () => {
        try {
          const geomData = await api.geometry({}, selectedWell);
          setActiveGeometry(geomData);
        } catch (e) {}
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive, selectedWell, activeGeometry?.geometry_status]);

  // Selected well geometry (either active or offset) for inspector
  const inspectorTargetGeometry = useMemo(() => {
    if (selectedOffsetWellId === selectedWell || !selectedOffsetWellId) {
      return activeGeometry;
    }
    return offsetGeometries.find(g => g.well_id === selectedOffsetWellId) || null;
  }, [selectedOffsetWellId, selectedWell, activeGeometry, offsetGeometries]);

  const inspectorRelationship = useMemo(() => {
    if (!selectedOffsetWellId || selectedOffsetWellId === selectedWell) return null;
    return offsets.find(r => r.offset_well_id === selectedOffsetWellId) || null;
  }, [selectedOffsetWellId, selectedWell, offsets]);

  // Inspected well ID
  const inspectedWellId = selectedOffsetWellId || selectedWell;

  // Fetch historical evidence for inspected well
  useEffect(() => {
    let active = true;
    async function loadEvidence() {
      if (!inspectedWellId) return;
      try {
        const evData = await api.historicalEvidence({}, inspectedWellId);
        if (active) setTargetEvidence(evData);
      } catch (e) {
        if (active) setTargetEvidence(null);
      }
    }
    loadEvidence();
    return () => { active = false; };
  }, [inspectedWellId]);

  const handleNavigateHistorical = (evt) => {
    if (evt?.start_timestamp) {
      setSelectedTimestamp(evt.start_timestamp);
    }
    navigate("/historical", { state: { wellId: inspectedWellId, eventId: evt?.event_id } });
  };

  const handleSelectWellFrom3D = (wellId) => {
    if (wellId === selectedWell) {
      setSelectedOffsetWellId(null);
      setFramingTarget("FOCUS_ACTIVE");
    } else {
      setSelectedOffsetWellId(wellId);
      setFramingTarget("FOCUS_SELECTED");
    }
  };

  const handleSetFocusContext = (wellId) => {
    setFocusContext({
      type: "well",
      key: wellId,
      label: `Spatial Context: ${wellId}`,
      meta: { wellId, timestamp: selectedTimestamp }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="page"
      style={{ gap: "var(--space-md)" }}
    >
      {/* Standard Page Header */}
      <div style={{ marginBottom: "var(--space-xs)" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          M0.9 Offset Intelligence · {selectedWell}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap", marginTop: 4 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-xl)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)", margin: 0, letterSpacing: "var(--tracking-display-xl)" }}>
            3D Offset Well Intelligence
          </h1>
          {isLive && <LiveBadge label="Live Simulation" size="md" />}
          {isSynthetic && !isLive && <DataQualityBadge status="synthetic" />}
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-md)", color: "var(--color-body)", margin: "var(--space-xs) 0 0", lineHeight: "var(--leading-body-md)" }}>
          Subsurface spatial engineering workspace. Inspect 3D well trajectories, measure surface distance and minimum wellbore separation, and inspect offset relationships.
        </p>
      </div>

      <FocusBanner />

      {/* LOOK-AHEAD INTELLIGENCE BANNER */}
      {intelligenceResult && (
        <div style={{
          background: intelligenceResult.look_ahead?.status === "AHEAD" || intelligenceResult.look_ahead?.status === "CURRENT" 
            ? "linear-gradient(90deg, #FEF3C7 0%, #FFFBEB 100%)" 
            : "#F8FAFC",
          border: `1px solid ${intelligenceResult.look_ahead?.status === "AHEAD" || intelligenceResult.look_ahead?.status === "CURRENT" ? "#F59E0B" : "#CBD5E1"}`,
          borderRadius: "var(--radius-md)",
          padding: "var(--space-sm) var(--space-md)",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className={`badge ${intelligenceResult.look_ahead?.status === "AHEAD" ? "badge-brass" : intelligenceResult.look_ahead?.status === "CURRENT" ? "badge-live" : "badge-outline"}`} style={{ fontSize: "10px", fontWeight: "bold" }}>
                LOOK-AHEAD: {intelligenceResult.look_ahead?.status || "UNAVAILABLE"}
              </span>
              {intelligenceResult.look_ahead?.tvd_ahead_start_ft != null && (
                <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", fontWeight: 600, color: "#92400E" }}>
                  {intelligenceResult.look_ahead.tvd_ahead_start_ft.toFixed(0)} ft TVD ahead ({intelligenceResult.look_ahead.md_ahead_start_ft?.toFixed(0)} ft MD ahead)
                </span>
              )}
              <span className="badge badge-outline" style={{ fontSize: "10px" }}>
                PROVENANCE: {intelligenceResult.provenance?.data_origin || "UNKNOWN"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <span className="badge badge-outline" style={{ fontSize: "10px" }}>
                CORRELATION: {intelligenceResult.historical_evidence?.correlation?.status || "APPROXIMATE"}
              </span>
              <span className="badge badge-teal" style={{ fontSize: "10px" }}>
                CONFIDENCE: {intelligenceResult.evidence_context?.confidence || "MODERATE"}
              </span>
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "#1E293B", lineHeight: "1.4" }}>
            {intelligenceResult.evidence_context?.summary_text}
          </div>
          {intelligenceResult.evidence_context?.limitations?.length > 0 && (
            <div style={{ fontFamily: "var(--font-code)", fontSize: "11px", color: "#64748B", marginTop: 2 }}>
              ⚠️ {intelligenceResult.evidence_context.limitations.join(" • ")}
            </div>
          )}
        </div>
      )}

      {/* Workspace Grid */}
      <div

        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 340px",
          gap: "var(--space-md)",
          height: "calc(100vh - 240px)",
          minHeight: "560px"
        }}
      >
        {/* LEFT PANEL: Wells in View */}
        <Panel label="Wells in View" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Quick Framing Action Buttons */}
          <div className="toggle" style={{ width: "100%", marginBottom: "var(--space-sm)" }}>
            <button
              onClick={() => setFramingTarget("FIT_ALL")}
              className={`toggle-button ${framingTarget === "FIT_ALL" ? "is-active" : ""}`}
              style={{ flex: 1 }}
            >
              Fit All
            </button>
            <button
              onClick={() => setFramingTarget("FOCUS_ACTIVE")}
              className={`toggle-button ${framingTarget === "FOCUS_ACTIVE" ? "is-active" : ""}`}
              style={{ flex: 1 }}
            >
              Focus Active
            </button>
          </div>

          {loading ? (
            <div style={{ color: "var(--color-mute)", fontSize: "var(--text-body-sm)", padding: "var(--space-sm)" }}>
              Loading geometry data...
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-xs)", paddingRight: "4px" }}>
              
              {/* ACTIVE WELL ROW */}
              <div
                onClick={() => {
                  setSelectedOffsetWellId(null);
                  setFramingTarget("FOCUS_ACTIVE");
                }}
                className="card-interactive"
                style={{
                  padding: "var(--space-sm)",
                  border: `1px solid ${selectedOffsetWellId === null || selectedOffsetWellId === selectedWell ? "var(--color-signal-teal)" : "var(--color-hairline)"}`,
                  borderRadius: "var(--radius-md)",
                  background: selectedOffsetWellId === null || selectedOffsetWellId === selectedWell ? "var(--color-signal-teal-soft)" : "var(--color-surface)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--font-body)", fontWeight: "var(--weight-semibold)", fontSize: "var(--text-body-sm)", color: "var(--color-ink)" }}>
                    ● {selectedWell}
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <span className="badge badge-live" style={{ fontSize: "10px", padding: "1px 6px" }}>
                      ACTIVE
                    </span>
                    <span className="badge badge-outline" style={{ fontSize: "10px", padding: "1px 6px" }}>
                      {activeGeometry?.data_origin === "SYNTHETIC_DEMO" ? "SYNTHETIC" : "HISTORICAL"}
                    </span>
                  </div>
                </div>

                <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-body)", marginTop: 6 }}>
                  {activeGeometry?.geometry_status === "UNAVAILABLE" ? (
                    <span style={{ color: "var(--color-brass)" }}>Geometry Unavailable</span>
                  ) : (
                    <>Current MD: {activeGeometry?.current_md ? `${activeGeometry.current_md.toFixed(0)} ft` : "—"}</>
                  )}
                </div>
              </div>

              {/* OFFSET WELL ROWS — color-coded to match 3D wireframe palette */}
              {offsets.map(off => {
                const isSelected = selectedOffsetWellId === off.offset_well_id;
                const wellColor = WELL_COLOR_PALETTE[off.offset_well_id] || "#94A3B8";
                return (
                  <div
                    key={off.offset_well_id}
                    onClick={() => {
                      setSelectedOffsetWellId(off.offset_well_id);
                      setFramingTarget("FOCUS_SELECTED");
                    }}
                    className="card-interactive"
                    style={{
                      padding: "var(--space-sm)",
                      borderTop: `1px solid ${isSelected ? wellColor : "var(--color-hairline)"}`,
                      borderRight: `1px solid ${isSelected ? wellColor : "var(--color-hairline)"}`,
                      borderBottom: `1px solid ${isSelected ? wellColor : "var(--color-hairline)"}`,
                      borderLeft: `4px solid ${wellColor}`,
                      borderRadius: "var(--radius-md)",

                      background: isSelected ? `${wellColor}18` : "var(--color-surface)",
                      cursor: "pointer",
                      transition: "background 0.15s ease, border-color 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        {/* Color swatch dot matching 3D scene */}
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: wellColor, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontFamily: "var(--font-body)", fontWeight: isSelected ? "var(--weight-semibold)" : "var(--weight-medium)", fontSize: "var(--text-body-sm)", color: "var(--color-ink)" }}>
                          {off.offset_well_id}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {isSelected && <span className="badge" style={{ fontSize: "10px", padding: "1px 6px", background: `${wellColor}33`, color: wellColor, border: `1px solid ${wellColor}66` }}>SELECTED</span>}
                        <span className="badge badge-outline" style={{ fontSize: "10px", padding: "1px 6px" }}>OFFSET</span>
                      </div>
                    </div>

                    <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-body)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                      <span>
                        {off.relevance_status === "UNAVAILABLE" ? (
                          <span style={{ color: "var(--color-brass)" }}>Unavailable</span>
                        ) : (
                          `Surf: ${off.surface_distance ? `${off.surface_distance.toFixed(0)} ft` : "—"}`
                        )}
                      </span>
                      {off.minimum_3d_separation != null && (
                        <span style={{ color: wellColor, fontWeight: "var(--weight-medium)" }}>
                          Min 3D: {off.minimum_3d_separation.toFixed(0)} ft
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* CENTER PANEL: 3D Scene & Spatial Toolbar */}
        <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--color-hairline)", position: "relative", background: "#F1F5F9" }}>
          
          {/* Top Header Overlay Bar */}
          <div style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            zIndex: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none"
          }}>
            <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center", pointerEvents: "auto" }}>
              <div style={{ background: "rgba(255,255,255,0.92)", padding: "6px 12px", borderRadius: "var(--radius-sm)", color: "#0F172A", fontSize: "var(--text-label-sm)", fontWeight: "var(--weight-semibold)", fontFamily: "var(--font-code)", border: "1px solid #CBD5E1", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
                3D SPATIAL VIEWPORT
              </div>
            </div>

            {/* VIEW MODE TOOLBAR — Tier 1: Primary views */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", pointerEvents: "auto" }}>
              <div className="toggle" style={{ background: "rgba(255,255,255,0.92)", borderColor: "#CBD5E1", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
                {["PERSPECTIVE", "TOP", "SIDE / TRAJECTORY"].map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setViewMode(mode); setFramingTarget("FOCUS_ACTIVE"); }}
                    className={`toggle-button ${viewMode === mode ? "is-active" : ""}`}
                    style={{ fontSize: "10px", fontFamily: "var(--font-code)", padding: "4px 10px" }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {/* Tier 2: Zoom sub-modes */}
              <div className="toggle" style={{ background: "rgba(255,255,255,0.85)", borderColor: "#E2E8F0" }}>
                {[
                  { key: "CLOSE-UP NEAR WELLHEAD", label: "CLOSE-UP" },
                  { key: "MID TRAJECTORY ZOOM", label: "MID ZOOM" },
                  { key: "DEEP SECTION ZOOM", label: "DEEP ZOOM" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    className={`toggle-button ${viewMode === key ? "is-active" : ""}`}
                    style={{ fontSize: "9px", fontFamily: "var(--font-code)", padding: "2px 8px" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Floating Measurement Toolbar */}
          <div style={{
            position: "absolute",
            top: 56,
            right: 12,
            zIndex: 10,
            display: "flex",
            gap: "4px",
            background: "rgba(255,255,255,0.92)",
            padding: "3px",
            borderRadius: "var(--radius-md)",
            border: "1px solid #CBD5E1",
            boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
          }}>
            <span style={{ fontSize: "11px", color: "#64748B", alignSelf: "center", padding: "0 6px", fontFamily: "var(--font-code)", fontWeight: 600 }}>
              MEASURE:
            </span>
            {["OFF", "SURFACE DISTANCE", "MINIMUM 3D SEPARATION"].map(m => (
              <button
                key={m}
                onClick={() => setMeasurementMode(m)}
                className={`toggle-button ${measurementMode === m ? "is-active" : ""}`}
                style={{
                  fontSize: "var(--text-data-sm)",
                  fontFamily: "var(--font-code)",
                  padding: "3px 8px"
                }}
              >
                {m}
              </button>
            ))}

            <span style={{ fontSize: "11px", color: "#64748B", alignSelf: "center", padding: "0 6px 0 10px", borderLeft: "1px solid #E2E8F0", fontFamily: "var(--font-code)", fontWeight: 600 }}>
              WINDOW:
            </span>
            {[200, 500, 1000].map(w => (
              <button
                key={w}
                onClick={() => setLookAheadWindow(w)}
                className={`toggle-button ${lookAheadWindow === w ? "is-active" : ""}`}
                style={{
                  fontSize: "var(--text-data-sm)",
                  fontFamily: "var(--font-code)",
                  padding: "3px 8px"
                }}
              >
                {w} FT
              </button>
            ))}
          </div>


          {/* Change 5: Loading skeleton rendered outside Canvas so user gets immediate feedback */}
          {loading && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 20,
              background: "#F8FAFC",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: "16px"
            }}>
              {/* Animated wireframe grid placeholder */}
              <svg width="180" height="120" viewBox="0 0 180 120" style={{ opacity: 0.45 }}>
                <line x1="0" y1="60" x2="180" y2="60" stroke="#0F766E" strokeWidth="0.5" strokeDasharray="4 4" />
                <line x1="90" y1="0" x2="90" y2="120" stroke="#0F766E" strokeWidth="0.5" strokeDasharray="4 4" />
                <polyline points="30,100 60,40 90,70 120,30 155,80" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="30,110 55,60 90,80 130,45 155,90" fill="none" stroke="#0284C7" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="83" y="4" width="14" height="22" fill="none" stroke="#0F766E" strokeWidth="1" />
                <rect x="86" y="26" width="8" height="10" fill="none" stroke="#0F766E" strokeWidth="0.5" />
              </svg>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                color: "#475569",
                fontWeight: 600,
                letterSpacing: "0.08em",
                animation: "pulse 1.6s ease-in-out infinite"
              }}>
                INITIALIZING 3D SPATIAL SCENE…
              </div>
              <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }`}</style>
            </div>
          )}

          {/* 3D Viewport Scene */}
          <OffsetWellScene
            activeGeometry={activeGeometry}
            offsetGeometries={offsetGeometries}
            selectedWellId={selectedWell}
            selectedOffsetWellId={selectedOffsetWellId}
            onSelectWell={handleSelectWellFrom3D}
            viewMode={viewMode}
            framingTarget={framingTarget}
            measurementMode={measurementMode}
            offsetRelationships={offsets}
            historicalEvents={targetEvidence?.events || []}
            intelligenceResult={intelligenceResult}
            isPlaying={isLive}
          />
        </div>


        {/* RIGHT PANEL: Well Inspector */}
        <Panel label="Well Inspector" style={{ display: "flex", flexDirection: "column", overflowY: "auto" }}>
          
          {!inspectorTargetGeometry ? (
            <div style={{ color: "var(--color-mute)", fontSize: "var(--text-body-sm)", fontStyle: "italic", padding: "var(--space-sm)" }}>
              Select a well from the list or click a trajectory in 3D to inspect spatial relationships.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              
              {/* INSPECTOR HEADER — single clean header, activate action at bottom only */}
              <div style={{ borderBottom: "1px solid var(--color-hairline)", paddingBottom: "var(--space-xs)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* Color swatch matching 3D scene palette */}
                    <span style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: inspectedWellId === selectedWell ? "#1E8A8A" : (WELL_COLOR_PALETTE[inspectedWellId] || "#94A3B8"),
                      flexShrink: 0
                    }} />
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-heading-md)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)" }}>
                      {inspectedWellId}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {inspectedWellId === selectedWell
                      ? <span className="badge badge-teal">ACTIVE WELL</span>
                      : <span className="badge badge-outline" style={{ fontSize: "10px" }}>OFFSET</span>
                    }
                    <span className="badge badge-brass" style={{ fontSize: "9px" }}>
                      {inspectorTargetGeometry.data_origin}
                    </span>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", marginTop: "2px" }}>
                  {inspectorTargetGeometry.well_name} • Status: {inspectorTargetGeometry.status}
                </div>
              </div>

              {/* SECTION: GEOMETRY */}
              <div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-slate)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-xs)" }}>
                  GEOMETRY
                </div>

                {inspectorTargetGeometry.geometry_status === "UNAVAILABLE" ? (
                  <div className="alert-card alert-card-watch" style={{ marginBottom: 0 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--weight-semibold)", fontSize: "var(--text-heading-sm)", marginBottom: "var(--space-xs)" }}>
                      GEOMETRY UNAVAILABLE
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", lineHeight: "var(--leading-body-sm)" }}>
                      No verified surface coordinates or wellbore survey are available for this historical well ({inspectedWellId}).
                    </div>
                    <div style={{ marginTop: "var(--space-sm)", fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-body)" }}>
                      Data Origin: {inspectorTargetGeometry.data_origin}<br/>
                      Provenance: {inspectorTargetGeometry.provenance}
                    </div>
                  </div>
                ) : (
                  <dl className="data-kv" style={{ background: "var(--color-surface-sunken)", padding: "var(--space-sm)", borderRadius: "var(--radius-md)" }}>
                    <div>
                      <dt>Surface X</dt>
                      <dd>{inspectorTargetGeometry.surface?.x != null ? `${inspectorTargetGeometry.surface.x.toFixed(1)} ft` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Surface Y</dt>
                      <dd>{inspectorTargetGeometry.surface?.y != null ? `${inspectorTargetGeometry.surface.y.toFixed(1)} ft` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Elevation</dt>
                      <dd>{inspectorTargetGeometry.surface?.elevation != null ? `${inspectorTargetGeometry.surface.elevation.toFixed(1)} ft` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Current MD</dt>
                      <dd>{inspectorTargetGeometry.current_md != null ? `${inspectorTargetGeometry.current_md.toFixed(0)} ft` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Max Inclination</dt>
                      <dd>{inspectorTargetGeometry.summary?.max_inclination != null ? `${inspectorTargetGeometry.summary.max_inclination.toFixed(1)}°` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{inspectorTargetGeometry.geometry_status}</dd>
                    </div>
                  </dl>
                )}
              </div>

              {/* SECTION: OFFSET INTELLIGENCE CONTEXT */}
              {intelligenceResult && inspectedWellId === selectedWell && (
                <div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-signal-teal)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-xs)" }}>
                    OFFSET INTELLIGENCE CONTEXT
                  </div>

                  <div style={{ background: "var(--color-surface-sunken)", padding: "var(--space-sm)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="metric-label">Mechanical Regime:</span>
                      <span className="code" style={{ fontWeight: 600, color: "var(--color-ink)" }}>
                        {intelligenceResult.current_behavior?.mechanical_regime || "NOMINAL"}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="metric-label">M0.8 Risk Level:</span>
                      <span className={`badge ${intelligenceResult.current_behavior?.risk?.risk_level === "HIGH" ? "badge-live" : "badge-teal"}`} style={{ fontSize: "10px" }}>
                        {intelligenceResult.current_behavior?.risk?.risk_level || "NORMAL"} ({intelligenceResult.current_behavior?.risk?.risk_score != null ? intelligenceResult.current_behavior.risk.risk_score.toFixed(0) : "—"})
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="metric-label">Look-Ahead Distance:</span>
                      <span className="code" style={{ color: "#D97706", fontWeight: 600 }}>
                        {intelligenceResult.look_ahead?.tvd_ahead_start_ft != null ? `${intelligenceResult.look_ahead.tvd_ahead_start_ft.toFixed(0)} ft TVD` : "N/A"}
                      </span>
                    </div>

                    {/* DIMENSIONS ACCORDION / TAGS */}
                    <div style={{ borderTop: "1px solid var(--color-hairline)", paddingTop: "6px", marginTop: "2px" }}>
                      <div style={{ fontSize: "10px", color: "var(--color-mute)", marginBottom: "4px", textTransform: "uppercase" }}>RELEVANCE DIMENSIONS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        <span className="badge badge-moss" style={{ fontSize: "10px" }}>SPATIAL: AVAILABLE</span>
                        <span className="badge badge-moss" style={{ fontSize: "10px" }}>DEPTH: AVAILABLE</span>
                        <span className="badge badge-outline" style={{ fontSize: "10px", color: "#B45309", borderColor: "#FCD34D" }}>
                          GEOLOGICAL: UNAVAILABLE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}


              {/* SECTION: HISTORICAL EVIDENCE */}
              <div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-brass)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-xs)" }}>
                  HISTORICAL EVIDENCE
                </div>

                {!targetEvidence || targetEvidence.count === 0 ? (
                  <div style={{ background: "var(--color-surface-sunken)", padding: "var(--space-sm)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ fontFamily: "var(--font-body)", fontWeight: "var(--weight-medium)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)" }}>
                      NO CONFIRMED HISTORICAL EVENTS
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-body)", marginTop: 4, lineHeight: "1.4" }}>
                      {targetEvidence?.note || "No authoritative historical event records are currently available for this well. Telemetry-derived anomalies are not treated as confirmed historical events."}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                    {targetEvidence.events.map(evt => (
                      <div
                        key={evt.event_id}
                        onClick={() => {
                          setSelectedEvent(evt);
                          setIsDrawerOpen(true);
                        }}
                        className="card-interactive"
                        style={{
                          padding: "var(--space-sm)",
                          border: "1px solid var(--color-hairline)",
                          borderRadius: "var(--radius-md)",
                          background: "var(--color-surface-sunken)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "var(--font-body)", fontWeight: "var(--weight-medium)", fontSize: "var(--text-body-sm)", color: "var(--color-ink)" }}>
                            {evt.event_type}
                          </span>
                          <span className={`badge ${evt.confirmation_status === "CONFIRMED" ? "badge-moss" : "badge-outline"}`} style={{ fontSize: "10px" }}>
                            {evt.confirmation_status}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", fontFamily: "var(--font-code)", color: "var(--color-body)", marginTop: 4 }}>
                          {evt.md_start != null ? `Depth: ${evt.md_start.toFixed(0)} ft MD` : "Depth Unavailable"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: SPATIAL RELATIONSHIP (If offset selected) */}
              {inspectorRelationship && (
                <div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-brass)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-xs)" }}>
                    SPATIAL RELATIONSHIP vs {selectedWell}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", background: "var(--color-surface-sunken)", padding: "var(--space-sm)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="metric-label">Surface Distance:</span>
                      <span className="code" style={{ fontWeight: "var(--weight-medium)" }}>
                        {inspectorRelationship.surface_distance != null ? `${inspectorRelationship.surface_distance.toFixed(0)} ft` : "—"}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="metric-label">Minimum 3D Separation:</span>
                      <span className="code" style={{ color: "var(--color-signal-teal)", fontWeight: "var(--weight-medium)" }}>
                        {inspectorRelationship.minimum_3d_separation != null ? `${inspectorRelationship.minimum_3d_separation.toFixed(0)} ft` : "—"}
                      </span>
                    </div>

                    {inspectorRelationship.closest_approach_md != null && (
                      <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-body)", paddingLeft: "var(--space-xs)", borderLeft: "2px solid var(--color-signal-teal)" }}>
                        Closest Approach: MD {inspectorRelationship.closest_approach_md.toFixed(0)} ft | TVD {inspectorRelationship.closest_approach_tvd?.toFixed(0)} ft
                      </div>
                    )}

                    {inspectorRelationship.depth_overlap_start != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                        <span className="metric-label">Depth Overlap:</span>
                        <span className="code">
                          {inspectorRelationship.depth_overlap_start.toFixed(0)} – {inspectorRelationship.depth_overlap_end?.toFixed(0)} ft TVD
                        </span>
                      </div>
                    )}

                    <div style={{ marginTop: "var(--space-xs)", paddingTop: "var(--space-xs)", borderTop: "1px solid var(--color-hairline)" }}>
                      <div style={{ fontSize: "10px", color: "var(--color-mute)", marginBottom: "4px", textTransform: "uppercase" }}>SUPPORTED DIMENSIONS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {inspectorRelationship.supported_dimensions?.map(dim => (
                          <span key={dim} className="badge badge-moss" style={{ fontSize: "10px", padding: "1px 6px" }}>
                            {dim}
                          </span>
                        ))}
                        {inspectorRelationship.unavailable_dimensions?.map(dim => (
                          <span key={dim} className="badge badge-outline" style={{ fontSize: "10px", padding: "1px 6px" }}>
                            {dim} (UNAVAILABLE)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CROSS-MODULE NAVIGATION */}
              <div style={{ marginTop: "var(--space-xs)", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {inspectorTargetGeometry.well_id !== selectedWell && (
                  <button
                    onClick={() => setSelectedWell(inspectorTargetGeometry.well_id)}
                    className="button button-signal"
                    style={{ width: "100%", height: "36px" }}
                  >
                    Set {inspectorTargetGeometry.well_id} as Active Well
                  </button>
                )}

                <button
                  onClick={() => handleNavigateHistorical({ event_id: null })}
                  className="button button-ghost"
                  style={{ width: "100%", height: "36px" }}
                >
                  View Historical Evidence Module →
                </button>
              </div>

            </div>
          )}
        </Panel>
      </div>

      {/* Evidence Drawer Overlay */}
      <EvidenceDrawer
        event={selectedEvent}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onNavigateHistorical={handleNavigateHistorical}
      />

    </motion.div>
  );
}
