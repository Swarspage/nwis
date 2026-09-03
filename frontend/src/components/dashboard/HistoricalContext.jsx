import EmptyState from "../ui/EmptyState.jsx";
import { formatValue } from "../../utils/format.js";
import { useAppState } from "../../app/AppState.jsx";
import { HiOutlineClock } from "react-icons/hi2";
import "./dashboard.css";

export default function HistoricalContext({ historical }) {
  const { selectedWell } = useAppState();
  const count = historical?.count ?? historical?.events?.length ?? 0;
  const isSynthetic = selectedWell !== "WELL-1";

  const description = isSynthetic
    ? `Verified historical events only. Historical evidence is unavailable for synthetic demo well ${selectedWell}.`
    : `Verified historical events only. Empty state is expected for ${selectedWell}.`;

  const emptyText = isSynthetic
    ? `Historical event evidence is unavailable for synthetic demo well ${selectedWell}. Simulation anomalies are not treated as historical ground truth.`
    : `No authoritative historical event documentation is currently available in the repository for ${selectedWell}. This is not an error.`;

  return (
    <div className="dashboard-card-light" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-ink, #0A2540)", fontFamily: "var(--font-display)" }}>
            M0.7 Historical Context
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-body, #5B6B7A)" }}>
            {description}
          </p>
        </div>
        <HiOutlineClock style={{ fontSize: 20, color: "var(--color-signal-teal, #1E8A8A)" }} />
      </div>

      {count === 0 ? (
        <EmptyState title="NO VERIFIED HISTORICAL EVENTS AVAILABLE">
          {emptyText}
        </EmptyState>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div className="metric-card-light">
            <div className="metric-card-label">Events Count</div>
            <div className="metric-card-value">{formatValue(count)}</div>
          </div>
          <div className="metric-card-light">
            <div className="metric-card-label">Status</div>
            <div className="metric-card-value">{historical?.status || "OK"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
