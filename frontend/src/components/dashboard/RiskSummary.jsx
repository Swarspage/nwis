import Badge from "../ui/Badge.jsx";
import { formatPercent, formatTimestamp, formatValue, titleize } from "../../utils/format.js";
import { HiOutlineShieldExclamation, HiOutlineClock, HiOutlineSparkles } from "react-icons/hi2";
import "./dashboard.css";

export default function RiskSummary({ risk }) {
  const score = risk?.risk_score ?? 0;
  const scoreLevelClass = score >= 70 ? "high" : score >= 40 ? "medium" : "low";

  return (
    <div className="risk-summary-card-light">
      <div className="risk-summary-top">
        <div>
          <div className="metric-card-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <HiOutlineShieldExclamation style={{ color: "var(--color-signal-teal, #1E8A8A)", fontSize: 15 }} />
            <span>Current Risk Score</span>
          </div>
          <div className="risk-score-display">
            <h2 className={`risk-score ${scoreLevelClass}`}>{formatValue(risk?.risk_score)}</h2>
            <span style={{ fontSize: 16, color: "var(--color-mute, #8C99A6)", fontWeight: 500 }}>/ 100</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge tone="outline">{titleize(risk?.risk_level)}</Badge>
          <Badge tone={risk?.alert ? "strong" : "outline"}>
            Alert {formatValue(risk?.alert)}
          </Badge>
        </div>
      </div>

      <p className="risk-explanation">{risk?.explanation || "No risk explanation returned by the API."}</p>

      <div className="snapshot-grid">
        <div className="metric-card-light">
          <div className="metric-card-label">Confidence</div>
          <div className="metric-card-value">{formatPercent(risk?.confidence)}</div>
          <div className="metric-card-subtext">Preserved from API</div>
        </div>

        <div className="metric-card-light">
          <div className="metric-card-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <HiOutlineClock style={{ fontSize: 12, color: "var(--color-signal-teal, #1E8A8A)" }} />
            <span>Timestamp</span>
          </div>
          <div className="metric-card-value" style={{ fontSize: 13 }}>{formatTimestamp(risk?.timestamp)}</div>
          <div className="metric-card-subtext">{risk?.data_origin || "Unknown origin"}</div>
        </div>

        <div className="metric-card-light">
          <div className="metric-card-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <HiOutlineSparkles style={{ fontSize: 12, color: "#7c3aed" }} />
            <span>Synthetic RF</span>
          </div>
          <div className="metric-card-value" style={{ color: risk?.prototype_supervised?.available ? "var(--color-moss, #2F6F4E)" : "var(--color-mute, #8C99A6)" }}>
            {risk?.prototype_supervised?.available ? "Isolated" : "Unavailable"}
          </div>
          <div className="metric-card-subtext">Not used in current risk score</div>
        </div>
      </div>
    </div>
  );
}
