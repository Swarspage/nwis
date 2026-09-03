/**
 * Header — Professional 3-zone NWIS application header.
 *
 * LEFT:   NWIS brand mark + interactive well selector dropdown
 * CENTER: Operational telemetry bar (Mode, Depth, Sim Clock)
 * RIGHT:  Risk state + Alert banner + Real-time API status
 */
import { useEffect, useState, useCallback } from "react";
import { api } from "../../api/client.js";
import { useAppState } from "../../app/AppState.jsx";
import LiveBadge from "../ui/LiveBadge.jsx";
import RiskLevelBadge from "../ui/RiskLevelBadge.jsx";
import DataQualityBadge from "../ui/DataQualityBadge.jsx";
import {
  HiOutlineCircleStack,
  HiChevronDown,
  HiOutlineClock,
  HiOutlineShieldExclamation,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineArrowTrendingUp
} from "react-icons/hi2";
import "./Header.css";

const WELL_PROFILES = {
  "WELL-1": {
    label: "WELL-1",
    sub: "Historical · VLOVE Dataset",
    mode: "Historical Replay",
    synthetic: false,
    badge: "VLOVE",
  },
  "WELL-2": {
    label: "WELL-2",
    sub: "Normal · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
    badge: "DEMO",
  },
  "WELL-3": {
    label: "WELL-3",
    sub: "Developing Deviation · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
    badge: "DEV",
  },
  "WELL-4": {
    label: "WELL-4",
    sub: "Transient Anomaly · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
    badge: "ANOM",
  },
  "WELL-5": {
    label: "WELL-5",
    sub: "Elevated Risk · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
    badge: "RISK",
  },
  "WELL-6": {
    label: "WELL-6",
    sub: "Recovery · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
    badge: "REC",
  },
};

export default function Header() {
  const { selectedWell, setSelectedWell, simulationState } = useAppState();
  const [health, setHealth] = useState("loading");
  const [wellsOpen, setWellsOpen] = useState(false);
  const [riskData, setRiskData] = useState(null);
  const [depthValue, setDepthValue] = useState(null);

  const isLive =
    simulationState?.mode === "LIVE_SIMULATION" &&
    simulationState?.status === "PLAYING";
  const isSynthetic = selectedWell !== "WELL-1";
  const profile = WELL_PROFILES[selectedWell] || WELL_PROFILES["WELL-1"];

  // API Health check
  useEffect(() => {
    let active = true;
    api
      .health()
      .then(() => {
        if (active) setHealth("ok");
      })
      .catch(() => {
        if (active) setHealth("error");
      });
    return () => {
      active = false;
    };
  }, []);

  // Risk polling for header badge
  useEffect(() => {
    let active = true;
    let timer = null;

    const fetchRisk = async () => {
      try {
        const r = await api.currentRisk(selectedWell);
        if (active) setRiskData(r);
      } catch {
        // silently fail — secondary
      } finally {
        if (active && isLive) {
          timer = setTimeout(fetchRisk, 3000);
        }
      }
    };

    fetchRisk();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [selectedWell, isLive]);

  // Depth polling
  useEffect(() => {
    let active = true;
    let timer = null;

    const fetchDepth = async () => {
      try {
        const t = await api.telemetry({ limit: 1 }, selectedWell);
        const latest = t?.records?.[t.records.length - 1];
        const d = latest?.measurements?.depth?.value ?? null;
        if (active) setDepthValue(d);
      } catch {
        if (active) setDepthValue(null);
      } finally {
        if (active && isLive) {
          timer = setTimeout(fetchDepth, 3000);
        }
      }
    };

    fetchDepth();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [selectedWell, isLive]);

  const closeDropdown = useCallback(() => setWellsOpen(false), []);

  const riskScore = riskData?.risk_score ?? null;
  const riskLevel = riskData?.risk_level ?? null;
  const alertActive = riskData?.alert === true || riskData?.alert === "true";

  const riskScoreColor =
    riskScore == null
      ? "var(--color-mute)"
      : riskScore >= 70
      ? "#ef4444"
      : riskScore >= 40
      ? "#f59e0b"
      : "#10b981";

  return (
    <header className="app-header">
      {/* ── LEFT: Brand + Well Selector ────────────────────── */}
      <div className="header-brand-group">
        <div className="brand-logo-container">
          <div className="brand-icon-wrapper" title="Nearby Wells Intelligence System">
            <HiOutlineCircleStack />
          </div>
          <div className="brand-text-wrapper">
            <div className="brand-title-row">
              <span className="brand-title">NWIS</span>
              <span className="brand-version-tag">v1.0</span>
            </div>
            <span className="brand-subtitle">Nearby Wells Intelligence</span>
          </div>
        </div>

        <div className="header-divider" />

        {/* Well selector */}
        <div className="well-selector-container">
          <button
            type="button"
            onClick={() => setWellsOpen((o) => !o)}
            className={`well-selector-btn ${wellsOpen ? "open" : ""}`}
            aria-haspopup="listbox"
            aria-expanded={wellsOpen}
            id="well-selector-btn"
          >
            <HiOutlineArrowTrendingUp className="well-icon" />
            <span>{profile.label}</span>
            <HiChevronDown className="chevron-icon" />
          </button>

          {wellsOpen && (
            <div role="listbox" className="well-dropdown-menu">
              <div className="dropdown-header">Select Operational Target</div>
              {Object.entries(WELL_PROFILES).map(([id, p]) => (
                <button
                  key={id}
                  role="option"
                  type="button"
                  aria-selected={id === selectedWell}
                  onClick={() => {
                    setSelectedWell(id);
                    setWellsOpen(false);
                  }}
                  className={`dropdown-option ${id === selectedWell ? "selected" : ""}`}
                >
                  <div className="option-left">
                    <span className="option-label">{p.label}</span>
                    <span className="option-sub">{p.sub}</span>
                  </div>
                  <span className="option-badge">{p.badge}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Operational Telemetry Bar ────────────────── */}
      <div className="header-center-bar">
        {/* Mode */}
        <div className="telemetry-chip">
          <span className="chip-label">Mode</span>
          {isLive ? (
            <LiveBadge label="Live Sim" />
          ) : isSynthetic ? (
            <DataQualityBadge status="synthetic" label="Synthetic" />
          ) : (
            <DataQualityBadge status="historical" label="Historical" />
          )}
        </div>

        <div className="header-divider" />

        {/* Depth */}
        <div className="telemetry-chip">
          <span className="chip-label">Depth</span>
          <span className={`chip-value ${depthValue == null ? "unavailable" : ""}`}>
            {depthValue != null ? `${depthValue.toFixed(0)} ft` : "Unavailable"}
          </span>
        </div>

        <div className="header-divider" />

        {/* Sim clock */}
        <div className="telemetry-chip">
          <span className="chip-label">{isLive ? "Sim Clock" : "Data Time"}</span>
          <span className="chip-value">
            <HiOutlineClock className="clock-icon" />
            {simulationState?.current_sim_time
              ? new Date(simulationState.current_sim_time).toLocaleTimeString(
                  "en-GB",
                  { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                )
              : "—"}
          </span>
        </div>
      </div>

      {/* ── RIGHT: Risk State & API Status ────────────── */}
      <div className="header-right-group">
        {/* Risk score + level */}
        {riskScore != null && (
          <div className="risk-chip-container">
            <span
              className="risk-score-val"
              style={{ color: riskScoreColor }}
            >
              {riskScore.toFixed(0)}
            </span>
            <RiskLevelBadge level={riskLevel} />
          </div>
        )}

        {/* Alert indicator */}
        {alertActive && (
          <div className="alert-banner-pill">
            <HiOutlineShieldExclamation />
            <span>Alert Active</span>
          </div>
        )}

        {/* API status */}
        <div className="api-status-pill" title={`Backend Health: ${health.toUpperCase()}`}>
          <span className={`api-dot ${health}`} />
          <span>{health === "ok" ? "API Online" : health === "error" ? "API Offline" : "Connecting..."}</span>
        </div>
      </div>

      {/* Click-away backdrop */}
      {wellsOpen && (
        <div
          onClick={closeDropdown}
          style={{ position: "fixed", inset: 0, zIndex: 90 }}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
