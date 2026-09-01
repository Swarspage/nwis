import { api } from "../../api/client.js";
import { useAppState } from "../../app/AppState.jsx";

export default function SimulationControls() {
  const { selectedWell, simulationState } = useAppState();

  // Only show for synthetic wells
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
        background: "var(--color-ink)",
        borderBottom: "1px solid rgba(234,240,238,0.08)",
        padding: "10px var(--space-xl)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--space-md)",
        flexShrink: 0,
      }}
    >
      {/* Label */}
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label-sm)",
          fontWeight: "var(--weight-medium)",
          color: "rgba(234,240,238,0.5)",
          letterSpacing: "0.01em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        Simulation
      </span>

      <div style={{ width: 1, height: 18, background: "rgba(234,240,238,0.12)" }} />

      {/* Play / Pause */}
      <button
        onClick={() => control(isPlaying ? "pause" : "start")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: isPlaying ? "var(--color-signal-teal)" : "rgba(234,240,238,0.1)",
          color: isPlaying ? "#fff" : "var(--color-sidebar-ink)",
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: "6px 14px",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-sm)",
          fontWeight: "var(--weight-medium)",
          cursor: "pointer",
          transition: "background 220ms",
        }}
        onMouseEnter={(e) => { if (!isPlaying) e.currentTarget.style.background = "rgba(234,240,238,0.18)"; }}
        onMouseLeave={(e) => { if (!isPlaying) e.currentTarget.style.background = "rgba(234,240,238,0.1)"; }}
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

      {/* Reset */}
      <button
        onClick={() => control("reset")}
        style={{
          background: "rgba(234,240,238,0.08)",
          color: "rgba(234,240,238,0.6)",
          border: "1px solid rgba(234,240,238,0.12)",
          borderRadius: "var(--radius-md)",
          padding: "5px 12px",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-sm)",
          cursor: "pointer",
          transition: "background 120ms",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(234,240,238,0.14)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(234,240,238,0.08)"}
      >
        Reset
      </button>

      <div style={{ width: 1, height: 18, background: "rgba(234,240,238,0.12)" }} />

      {/* Speed buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "10px",
            color: "rgba(234,240,238,0.35)",
            marginRight: 4,
          }}
        >
          Speed
        </span>
        {[1, 5, 10, 60].map((s) => (
          <button
            key={s}
            onClick={() => control("speed", { speed: s })}
            style={{
              background: speed === s ? "var(--color-signal-teal)" : "rgba(234,240,238,0.07)",
              color: speed === s ? "#fff" : "rgba(234,240,238,0.55)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "4px 9px",
              fontFamily: "var(--font-code)",
              fontSize: "11px",
              fontWeight: "var(--weight-medium)",
              cursor: "pointer",
              transition: "background 120ms, color 120ms",
            }}
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Clock */}
      <div style={{ marginLeft: "auto" }}>
        <span
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-data-sm)",
            color: "rgba(234,240,238,0.45)",
          }}
        >
          {simulationState?.current_sim_time
            ? new Date(simulationState.current_sim_time).toLocaleTimeString("en-GB", {
                hour: "2-digit", minute: "2-digit", second: "2-digit"
              })
            : "—"}
        </span>
      </div>
    </div>
  );
}
