import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import Metric from "../ui/Metric.jsx";
import { formatPercent, formatTimestamp, formatValue, titleize } from "../../utils/format.js";
import "./dashboard.css";

export default function RiskSummary({ risk }) {
  return (
    <Card dark className="risk-summary">
      <div className="risk-summary-top">
        <div>
          <p className="metric-label">Current risk score</p>
          <p className="risk-score">{formatValue(risk?.risk_score)}</p>
        </div>
        <div className="pill-row">
          <Badge tone="outline">{titleize(risk?.risk_level)}</Badge>
          <Badge tone={risk?.alert ? "strong" : "outline"}>Alert {formatValue(risk?.alert)}</Badge>
        </div>
      </div>
      <p className="risk-explanation">{risk?.explanation || "No risk explanation returned by the API."}</p>
      <div className="snapshot-grid">
        <Metric label="Confidence" value={formatPercent(risk?.confidence)} subtext="Preserved from API" />
        <Metric label="Timestamp" value={formatTimestamp(risk?.timestamp)} subtext={risk?.data_origin || "Unknown origin"} />
        <Metric
          label="Synthetic RF"
          value={risk?.prototype_supervised?.available ? "Isolated" : "Unavailable"}
          subtext="Not used in current risk score"
        />
      </div>
    </Card>
  );
}
