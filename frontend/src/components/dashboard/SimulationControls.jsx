import { api } from "../../api/client.js";
import { useAppState } from "../../app/AppState.jsx";

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
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999,
        background: "rgba(15, 23, 42, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "var(--radius-pill)",
        padding: "6px 18px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.2)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-md)",
        maxWidth: "92vw",
        transition: "all var(--motion-normal) var(--ease-standard)",
      }}
      className="simulation-dock"
    >
      {/* Simulation status dot & badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isPlaying ? "var(--color-signal-teal)" : "#f59e0b",
            boxShadow: isPlaying ? "0 0 8px var(--color-signal-teal)" : "none",
            display: "inline-block",
            transition: "all 300ms",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            fontWeight: "var(--weight-semibold)",
            color: "rgba(248, 250, 252, 0.85)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {isPlaying ? "Simulating" : "Paused"}
        </span>
      </div>

      <div style={{ width: 1, height: 16, background: "rgba(255, 255, 255, 0.12)" }} />

      {/* Play / Pause Toggle */}
      <button
        onClick={() => control(isPlaying ? "pause" : "start")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: isPlaying ? "var(--color-signal-teal)" : "rgba(255, 255, 255, 0.12)",
          color: "#ffffff",
          border: "none",
          borderRadius: "var(--radius-pill)",
          padding: "5px 14px",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label-sm)",
          fontWeight: "var(--weight-medium)",
          cursor: "pointer",
          transition: "background var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)",
        }}
        className="button"
      >
        {isPlaying ? (
          <>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect x="1" y="1" width="3" height="8" rx="1" />
              <rect x="6" y="1" width="3" height="8" rx="1" />
            </svg>
            Pause
          </>
        ) : (
          <>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <polygon points="2,1 9,5 2,9" />
            </svg>
            Play
          </>
        )}
      </button>

      {/* Reset Button */}
      <button
        onClick={() => control("reset")}
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          color: "rgba(248, 250, 252, 0.75)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "var(--radius-pill)",
          padding: "4px 12px",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label-sm)",
          fontWeight: "var(--weight-medium)",
          cursor: "pointer",
          transition: "background var(--motion-fast) var(--ease-standard)",
        }}
        className="button"
      >
        Reset
      </button>

      <div style={{ width: 1, height: 16, background: "rgba(255, 255, 255, 0.12)" }} />

      {/* Speed Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[1, 5, 10, 60].map((s) => (
          <button
            key={s}
            onClick={() => control("speed", { speed: s })}
            style={{
              background: speed === s ? "rgba(255, 255, 255, 0.2)" : "transparent",
              color: speed === s ? "#ffffff" : "rgba(248, 250, 252, 0.55)",
              border: speed === s ? "1px solid rgba(255, 255, 255, 0.25)" : "1px solid transparent",
              borderRadius: "var(--radius-sm)",
              padding: "2px 7px",
              fontFamily: "var(--font-code)",
              fontSize: "11px",
              fontWeight: "var(--weight-medium)",
              cursor: "pointer",
              transition: "all var(--motion-fast) var(--ease-standard)",
            }}
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Sim Clock readout */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 1, height: 16, background: "rgba(255, 255, 255, 0.12)" }} />
        <span
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "12px",
            color: "var(--color-signal-teal)",
            fontWeight: "var(--weight-medium)",
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
