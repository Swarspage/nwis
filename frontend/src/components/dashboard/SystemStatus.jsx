import Badge from "../ui/Badge.jsx";
import { formatValue } from "../../utils/format.js";
import { HiOutlineServer, HiOutlineDatabase, HiOutlineSignal } from "react-icons/hi2";
import "./dashboard.css";

export default function SystemStatus({ summary, health, well }) {
  return (
    <div className="dashboard-card-light">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-ink, #0A2540)", fontFamily: "var(--font-display)" }}>
            System Status
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-body, #5B6B7A)" }}>
            Backend availability and data inventory.
          </p>
        </div>
        <HiOutlineServer style={{ fontSize: 20, color: "var(--color-signal-teal, #1E8A8A)" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="metric-card-light">
          <div className="metric-card-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <HiOutlineDatabase style={{ color: "var(--color-signal-teal, #1E8A8A)", fontSize: 13 }} />
            <span>Target Well</span>
          </div>
          <div className="metric-card-value">{well?.well_id || summary?.well_id || "WELL-1"}</div>
          <div className="metric-card-subtext">{well?.source_system || "Source unknown"}</div>
        </div>

        <div className="metric-card-light">
          <div className="metric-card-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <HiOutlineSignal style={{ color: health?.status === "ok" ? "#059669" : "#dc2626", fontSize: 13 }} />
            <span>API Gateway</span>
          </div>
          <div className="metric-card-value" style={{ color: health?.status === "ok" ? "#059669" : "#dc2626" }}>
            {health?.status || "Not available"}
          </div>
          <div className="metric-card-subtext">{health?.service || "nwis-api"}</div>
        </div>

        <div className="metric-card-light">
          <div className="metric-card-label">Risk Records</div>
          <div className="metric-card-value">{formatValue(summary?.risk_records_generated)}</div>
          <div className="metric-card-subtext">{summary?.note || "Generated telemetry dataset"}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-hairline, #DFE6E3)" }}>
        <Badge tone={summary?.m05_intelligence_available ? "outline" : "default"}>
          M0.5 {formatValue(summary?.m05_intelligence_available)}
        </Badge>
        <Badge tone={summary?.m06_statistical_models_available ? "outline" : "default"}>
          M0.6 {formatValue(summary?.m06_statistical_models_available)}
        </Badge>
        <Badge>
          M0.7 verified events {formatValue(summary?.m07_verified_historical_events_available)}
        </Badge>
        <Badge>
          Supervised labels {formatValue(summary?.supervised_event_labels_available)}
        </Badge>
      </div>
    </div>
  );
}
