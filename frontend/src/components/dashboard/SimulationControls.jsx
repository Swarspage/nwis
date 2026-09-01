import { api } from "../../api/client.js";
import { useAppState } from "../../app/AppState.jsx";

export default function SimulationControls() {
  const { simulationState, selectedWell } = useAppState();

  if (selectedWell === "WELL-1") {
    return null; // Not applicable for WELL-1
  }

  const isLive = simulationState?.mode === "LIVE_SIMULATION";
  const status = simulationState?.status;

  const handleAction = async (action, speed) => {
    try {
      await api.simulationControl({ action, speed, mode: "LIVE_SIMULATION" });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: "16px", background: "var(--nwis-surface-panel)", borderBottom: "1px solid var(--nwis-border-subtle)", display: "flex", gap: "16px", alignItems: "center" }}>
      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Live Simulation Controls</h3>
      
      {!isLive || status === "PAUSED" ? (
        <button className="nwis-button" onClick={() => handleAction("start")}>▶ Play</button>
      ) : (
        <button className="nwis-button" onClick={() => handleAction("pause")}>⏸ Pause</button>
      )}
      
      <button className="nwis-button outline" onClick={() => handleAction("reset")}>⏮ Reset</button>

      <div style={{ display: "flex", gap: "8px" }}>
        {[1, 5, 10, 60].map(s => (
          <button 
            key={s} 
            className={`nwis-button outline ${simulationState?.speed === s ? 'active' : ''}`}
            onClick={() => handleAction("speed", s)}
            style={simulationState?.speed === s ? { background: "var(--nwis-color-interactive)", color: "white" } : {}}
          >
            {s}x
          </button>
        ))}
      </div>
      
      <div style={{ marginLeft: "auto", fontSize: "12px", color: "var(--nwis-text-secondary)" }}>
        Sim Clock: {simulationState?.current_sim_time || "Offline"}
      </div>
    </div>
  );
}
