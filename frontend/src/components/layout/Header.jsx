import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { useAppState } from "../../app/AppState.jsx";

const WELL_PROFILES = {
  "WELL-1": { label: "WELL-1", sub: "Historical · Replay" },
  "WELL-2": { label: "WELL-2", sub: "Normal · Synthetic" },
  "WELL-3": { label: "WELL-3", sub: "Developing Deviation · Synthetic" },
  "WELL-4": { label: "WELL-4", sub: "Transient Anomaly · Synthetic" },
  "WELL-5": { label: "WELL-5", sub: "Elevated Risk · Synthetic" },
  "WELL-6": { label: "WELL-6", sub: "Recovery · Synthetic" },
};

export default function Header() {
  const { selectedWell, setSelectedWell, simulationState } = useAppState();
  const [health, setHealth] = useState("loading");
  const [wellsOpen, setWellsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api.health()
      .then(() => { if (active) setHealth("ok"); })
      .catch(() => { if (active) setHealth("error"); });
    return () => { active = false; };
  }, []);

  const isLive = simulationState?.mode === "LIVE_SIMULATION" && simulationState?.status === "PLAYING";
  const isSynthetic = selectedWell !== "WELL-1";
  const profile = WELL_PROFILES[selectedWell] || WELL_PROFILES["WELL-1"];

  return (
    <header className="app-header">
      {/* Left: wordmark + well selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-heading-md)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--color-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          NWIS
        </span>

        {/* Well selector button */}
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
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--color-signal-teal)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--color-hairline-strong)"}
            aria-haspopup="listbox"
            aria-expanded={wellsOpen}
          >
            {profile.label}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4, marginLeft: 2 }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {wellsOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                background: "var(--color-surface)",
                border: "1px solid var(--color-hairline)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 4px 16px rgba(10,37,64,0.12)",
                zIndex: 100,
                minWidth: 220,
                overflow: "hidden",
              }}
            >
              {Object.entries(WELL_PROFILES).map(([id, p]) => (
                <button
                  key={id}
                  onClick={() => { setSelectedWell(id); setWellsOpen(false); }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                    padding: "10px 14px",
                    background: id === selectedWell ? "var(--color-canvas)" : "transparent",
                    border: "none",
                    borderLeft: id === selectedWell ? "3px solid var(--color-signal-teal)" : "3px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (id !== selectedWell) e.currentTarget.style.background = "var(--color-surface-sunken)"; }}
                  onMouseLeave={(e) => { if (id !== selectedWell) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-md)", fontWeight: "var(--weight-medium)", color: "var(--color-ink)" }}>
                    {p.label}
                  </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-mute)", marginTop: 1 }}>
                    {p.sub}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Synthetic pill */}
        {isSynthetic && (
          <div
            style={{
              background: "var(--color-brass-soft)",
              color: "var(--color-brass)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-label-sm)",
              fontWeight: "var(--weight-medium)",
              padding: "3px 10px",
              borderRadius: "var(--radius-pill)",
            }}
          >
            Synthetic Demo
          </div>
        )}

        {/* Live pill */}
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
            Live Simulation
          </div>
        )}
      </div>

      {/* Right: API status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-xs)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-sm)",
          color: health === "ok" ? "var(--color-moss)" : health === "error" ? "var(--color-rust)" : "var(--color-mute)",
        }}
      >
        <span style={{ fontSize: 8 }}>●</span>
        {health === "ok" ? "API Connected" : health === "error" ? "API Unavailable" : "Checking…"}
      </div>

      {/* Click-away */}
      {wellsOpen && (
        <div
          onClick={() => setWellsOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 50 }}
        />
      )}
    </header>
  );
}
