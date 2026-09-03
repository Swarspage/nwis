import { api } from "../../api/client.js";
import { useAppState } from "../../app/AppState.jsx";
import { HiPlay, HiPause, HiArrowPath, HiClock } from "react-icons/hi2";
import "./dashboard.css";

export default function SimulationControls() {
  const { selectedWell, simulationState } = useAppState();

  // Only render for synthetic demo wells
  if (selectedWell === "WELL-1") return null;

  const status = simulationState?.status ?? "PAUSED";
  const speed = simulationState?.speed ?? 1;
  const isPlaying = status === "PLAYING";

  const control = async (action, extra = {}) => {
    try {
      await api.simulationControl({ action, mode: "LIVE_SIMULATION", ...extra });
    } catch (err) {
      console.error("Simulation control failed:", err);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999,
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(245, 247, 246, 0.96) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--color-hairline, #DFE6E3)",
        borderRadius: "9999px",
        padding: "8px 20px",
        boxShadow: "0 12px 36px rgba(10, 37, 64, 0.12), 0 2px 6px rgba(10, 37, 64, 0.04)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        maxWidth: "92vw",
        transition: "all 0.25s ease",
      }}
      className="simulation-dock"
    >
      {/* Status Dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isPlaying ? "#10b981" : "#f59e0b",
            boxShadow: isPlaying ? "0 0 8px rgba(16, 185, 129, 0.5)" : "none",
            display: "inline-block",
            transition: "all 300ms",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--color-ink, #0A2540)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {isPlaying ? "Simulating" : "Paused"}
        </span>
      </div>

      <div style={{ width: 1, height: 18, background: "var(--color-hairline, #DFE6E3)" }} />

      {/* Play / Pause Toggle */}
      <button
        type="button"
        onClick={() => control(isPlaying ? "pause" : "start")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: isPlaying ? "var(--color-signal-teal, #1E8A8A)" : "var(--color-surface-sunken, #F0F3F2)",
          color: isPlaying ? "#ffffff" : "var(--color-ink, #0A2540)",
          border: isPlaying ? "none" : "1px solid var(--color-hairline, #DFE6E3)",
          borderRadius: "9999px",
          padding: "6px 16px",
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: isPlaying ? "0 2px 10px rgba(30, 138, 138, 0.3)" : "none",
        }}
      >
        {isPlaying ? <HiPause style={{ fontSize: 14 }} /> : <HiPlay style={{ fontSize: 14 }} />}
        <span>{isPlaying ? "Pause" : "Play"}</span>
      </button>

      {/* Reset Button */}
      <button
        type="button"
        onClick={() => control("reset")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "var(--color-surface-sunken, #F0F3F2)",
          color: "var(--color-ink, #0A2540)",
          border: "1px solid var(--color-hairline, #DFE6E3)",
          borderRadius: "9999px",
          padding: "5px 14px",
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <HiArrowPath style={{ fontSize: 13 }} />
        <span>Reset</span>
      </button>

      <div style={{ width: 1, height: 18, background: "var(--color-hairline, #DFE6E3)" }} />

      {/* Speed Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[1, 5, 10, 60].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => control("speed", { speed: s })}
            style={{
              background: speed === s ? "var(--color-signal-teal-soft, #E3F2F0)" : "transparent",
              color: speed === s ? "var(--color-signal-teal, #1E8A8A)" : "var(--color-body, #5B6B7A)",
              border: speed === s ? "1px solid rgba(30, 138, 138, 0.4)" : "1px solid transparent",
              borderRadius: "6px",
              padding: "3px 8px",
              fontFamily: "var(--font-code)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Sim Clock readout */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 1, height: 18, background: "var(--color-hairline, #DFE6E3)" }} />
        <HiClock style={{ color: "var(--color-signal-teal, #1E8A8A)", fontSize: 14 }} />
        <span
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "12px",
            color: "var(--color-signal-teal, #1E8A8A)",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {simulationState?.current_sim_time
            ? new Date(simulationState.current_sim_time).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "—"}
        </span>
      </div>
    </div>
  );
}
