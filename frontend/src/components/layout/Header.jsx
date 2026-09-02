/**
 * Header — 3-zone enhanced NWIS application header.
 *
 * LEFT:   NWIS wordmark + well selector dropdown
 * CENTER: Operational context — well ID, mode, data status, depth
 * RIGHT:  Risk state + alert indicator + API status
 *
 * All values derived from actual API state / simulationState.
 * Depth shows "Unavailable" when null — never fabricated.
 */
import { useEffect, useState, useCallback } from "react";
import { api } from "../../api/client.js";
import { useAppState } from "../../app/AppState.jsx";
import LiveBadge from "../ui/LiveBadge.jsx";
import RiskLevelBadge from "../ui/RiskLevelBadge.jsx";
import DataQualityBadge from "../ui/DataQualityBadge.jsx";

const WELL_PROFILES = {
  "WELL-1": {
    label: "WELL-1",
    sub: "Historical · VLOVE Dataset",
    mode: "Historical Replay",
    synthetic: false,
  },
  "WELL-2": {
    label: "WELL-2",
    sub: "Normal · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
  },
  "WELL-3": {
    label: "WELL-3",
    sub: "Developing Deviation · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
  },
  "WELL-4": {
    label: "WELL-4",
    sub: "Transient Anomaly · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
  },
  "WELL-5": {
    label: "WELL-5",
    sub: "Elevated Risk · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
  },
  "WELL-6": {
    label: "WELL-6",
    sub: "Recovery · Synthetic Demo",
    mode: "Live Simulation",
    synthetic: true,
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

  // Health check
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

  // Risk polling for header badge (lightweight — only score + level)
  useEffect(() => {
    let active = true;
    let timer = null;

    const fetchRisk = async () => {
      try {
        const r = await api.currentRisk(selectedWell);
        if (active) setRiskData(r);
      } catch {
        // silently fail — header risk is secondary
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

  // Depth polling (from telemetry, canonical path: measurements.depth.value)
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
      ? "var(--color-rust)"
      : riskScore >= 40
      ? "var(--color-brass)"
      : "var(--color-moss)";

  return (
    <header className="app-header" style={{ position: "sticky", top: 0, zIndex: 20 }}>
      {/* ── LEFT: wordmark + well selector ────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
          minWidth: 0,
          flexShrink: 0,
        }}
      >
        {/* Wordmark */}
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-heading-md)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-ink)",
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            NWIS
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              color: "var(--color-mute)",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            Nearby Wells Intelligence
          </div>
        </div>

        <div
          style={{
            width: 1,
            height: 28,
            background: "var(--color-hairline)",
            flexShrink: 0,
          }}
        />

        {/* Well selector */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setWellsOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              background: "var(--color-canvas)",
              border: "1px solid var(--color-hairline-strong)",
              borderRadius: "var(--radius-md)",
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-data-md)",
              fontWeight: "var(--weight-medium)",
              color: "var(--color-ink)",
              transition: "border-color 220ms",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-signal-teal)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor =
                "var(--color-hairline-strong)")
            }
            aria-haspopup="listbox"
            aria-expanded={wellsOpen}
            id="well-selector-btn"
          >
            {profile.label}
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              style={{ opacity: 0.4, marginLeft: 2 }}
            >
              <path
                d="M2 4l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {wellsOpen && (
            <div
              role="listbox"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                background: "var(--color-surface)",
                border: "1px solid var(--color-hairline)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 4px 16px rgba(10,37,64,0.12)",
                zIndex: 100,
                minWidth: 240,
                overflow: "hidden",
              }}
            >
              {Object.entries(WELL_PROFILES).map(([id, p]) => (
                <button
                  key={id}
                  role="option"
                  aria-selected={id === selectedWell}
                  onClick={() => {
                    setSelectedWell(id);
                    setWellsOpen(false);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                    padding: "10px 14px",
                    background:
                      id === selectedWell
                        ? "var(--color-canvas)"
                        : "transparent",
                    border: "none",
                    borderLeft:
                      id === selectedWell
                        ? "3px solid var(--color-signal-teal)"
                        : "3px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    if (id !== selectedWell)
                      e.currentTarget.style.background =
                        "var(--color-surface-sunken)";
                  }}
                  onMouseLeave={(e) => {
                    if (id !== selectedWell)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-code)",
                      fontSize: "var(--text-data-md)",
                      fontWeight: "var(--weight-medium)",
                      color: "var(--color-ink)",
                    }}
                  >
                    {p.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "10px",
                      color: "var(--color-mute)",
                      marginTop: 1,
                    }}
                  >
                    {p.sub}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: operational context ────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-lg)",
          flexWrap: "wrap",
          justifyContent: "center",
          flex: 1,
          minWidth: 0,
          padding: "0 var(--space-md)",
        }}
      >
        {/* Mode */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              color: "var(--color-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Mode
          </div>
          {isLive ? (
            <LiveBadge label="Live Simulation" />
          ) : isSynthetic ? (
            <DataQualityBadge status="synthetic" label="Synthetic Demo" />
          ) : (
            <DataQualityBadge status="historical" label="Historical Replay" />
          )}
        </div>

        <div
          style={{
            width: 1,
            height: 28,
            background: "var(--color-hairline)",
            flexShrink: 0,
          }}
        />

        {/* Depth */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              color: "var(--color-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Depth
          </div>
          <div
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-data-sm)",
              fontWeight: "var(--weight-medium)",
              color:
                depthValue != null ? "var(--color-ink)" : "var(--color-mute)",
              fontStyle: depthValue == null ? "italic" : "normal",
            }}
          >
            {depthValue != null ? `${depthValue.toFixed(0)} ft` : "Unavailable"}
          </div>
        </div>

        <div
          style={{
            width: 1,
            height: 28,
            background: "var(--color-hairline)",
            flexShrink: 0,
          }}
        />

        {/* Sim clock */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              color: "var(--color-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {isLive ? "Sim Clock" : "Data Time"}
          </div>
          <div
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-data-sm)",
              color: "var(--color-ink)",
            }}
          >
            {simulationState?.current_sim_time
              ? new Date(simulationState.current_sim_time).toLocaleTimeString(
                  "en-GB",
                  { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                )
              : "—"}
          </div>
        </div>
      </div>

      {/* ── RIGHT: risk state + alerts + api status ────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
          flexShrink: 0,
        }}
      >
        {/* Risk score + level */}
        {riskScore != null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-code)",
                fontSize: "var(--text-data-md)",
                fontWeight: "var(--weight-medium)",
                color: riskScoreColor,
              }}
            >
              {riskScore.toFixed(0)}
            </span>
            <RiskLevelBadge level={riskLevel} />
          </div>
        )}

        {/* Alert indicator */}
        {alertActive && (
          <div
            style={{
              background: "var(--color-rust-soft)",
              border: "1px solid var(--color-rust)",
              color: "var(--color-rust)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-label-sm)",
              fontWeight: "var(--weight-medium)",
              padding: "3px 10px",
              borderRadius: "var(--radius-pill)",
              display: "flex",
              alignItems: "center",
              gap: 5,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 8 }}>▲</span>
            Alert
          </div>
        )}

        {/* API status dot */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xxs)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            color:
              health === "ok"
                ? "var(--color-moss)"
                : health === "error"
                ? "var(--color-rust)"
                : "var(--color-mute)",
          }}
        >
          <span style={{ fontSize: 8 }}>●</span>
          <span style={{ display: "none" }}>
            {health === "ok"
              ? "API"
              : health === "error"
              ? "API Err"
              : "…"}
          </span>
        </div>
      </div>

      {/* Click-away for dropdown */}
      {wellsOpen && (
        <div
          onClick={closeDropdown}
          style={{ position: "fixed", inset: 0, zIndex: 50 }}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
