import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { useAppState } from "../../app/AppState.jsx";
import SimulationToggle from "../ui/SimulationToggle.jsx";
import Badge from "../ui/Badge.jsx";

export default function Header() {
  const { simulationMode, setSimulationMode, selectedWell, setSelectedWell, simulationState } = useAppState();
  const [health, setHealth] = useState({ state: "loading", data: null });

  useEffect(() => {
    let active = true;
    api
      .health()
      .then((data) => {
        if (active) setHealth({ state: "ok", data });
      })
      .catch((error) => {
        if (active) setHealth({ state: "error", data: error });
      });
    return () => {
      active = false;
    };
  }, []);

  const ok = health.state === "ok";
  const isLive = simulationState?.mode === "LIVE_SIMULATION";
  const isSynthetic = selectedWell !== "WELL-1";

  return (
    <header className="app-header">
      <div className="header-brand">
        <h1 className="brand-title">NWIS</h1>
        <select 
          value={selectedWell} 
          onChange={(e) => setSelectedWell(e.target.value)}
          style={{marginLeft: "16px", background: "var(--nwis-surface-panel)", color: "var(--nwis-text-primary)", border: "1px solid var(--nwis-border-strong)", padding: "4px 8px", borderRadius: "4px"}}
        >
          <option value="WELL-1">WELL-1 (Historical)</option>
          <option value="WELL-2">WELL-2 (Synthetic)</option>
          <option value="WELL-3">WELL-3 (Synthetic)</option>
          <option value="WELL-4">WELL-4 (Synthetic)</option>
          <option value="WELL-5">WELL-5 (Synthetic)</option>
          <option value="WELL-6">WELL-6 (Synthetic)</option>
        </select>
        
        {isSynthetic && <Badge tone="amber" style={{marginLeft: "12px"}}>SYNTHETIC DEMO</Badge>}
        {isLive && <Badge tone="moss" style={{marginLeft: "8px"}}>LIVE SIMULATION</Badge>}
      </div>

      <div className="header-status">
        <Badge tone={ok ? "moss" : health.state === "error" ? "rust" : "outline"}>
          {ok ? "API CONNECTED" : health.state === "error" ? "API UNAVAILABLE" : "CHECKING API"}
        </Badge>
        <SimulationToggle value={simulationMode} onChange={setSimulationMode} />
      </div>
    </header>
  );
}
