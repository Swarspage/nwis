import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { api } from "../api/client.js";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [simulationMode, setSimulationMode] = useState("replay");
  const [selectedTimestamp, setSelectedTimestamp] = useState(null);
  const [selectedWell, setSelectedWellState] = useState("WELL-1");
  const [simulationState, setSimulationState] = useState(null);

  // Cross-panel focus context — set by any panel, consumed across pages.
  // Shape: { type: 'signal'|'evidence'|'driver'|'well'|'depth'|'timestamp', key, label, meta }
  const [focusContext, setFocusContext] = useState(null);

  const setSelectedWell = (wellId) => {
    setSelectedWellState(wellId);
    if (wellId !== "WELL-1") {
      setSimulationMode("live");
    } else {
      setSimulationMode("replay");
    }
  };

  useEffect(() => {
    // Poll simulation status every 1s
    let active = true;
    const fetchStatus = async () => {
      try {
        const res = await api.simulationStatus();
        if (active) {
          setSimulationState(res);
          if (res.mode === "LIVE_SIMULATION" && res.status === "PLAYING") {
            setSelectedTimestamp(res.current_sim_time);
          }
        }
      } catch (err) {
        console.error("Failed to fetch simulation status", err);
      }
    };
    
    fetchStatus();
    const intv = setInterval(fetchStatus, 1000);
    return () => {
      active = false;
      clearInterval(intv);
    };
  }, []);

  const value = useMemo(
    () => ({
      simulationMode,
      setSimulationMode,
      selectedTimestamp,
      setSelectedTimestamp,
      selectedWell,
      setSelectedWell,
      simulationState,
      setSimulationState,
      focusContext,
      setFocusContext,
    }),
    [simulationMode, selectedTimestamp, selectedWell, simulationState, focusContext],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return context;
}
