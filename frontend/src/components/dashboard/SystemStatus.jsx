import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import Metric from "../ui/Metric.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import { formatValue } from "../../utils/format.js";

export default function SystemStatus({ summary, health, well }) {
  return (
    <Card>
      <SectionHeader title="System Status" description="Backend availability and data inventory." />
      <div className="card-grid">
        <div className="span-4">
          <Metric label="Well" value={well?.well_id || summary?.well_id || "WELL-1"} subtext={well?.source_system || "Source unknown"} />
        </div>
        <div className="span-4">
          <Metric label="API" value={health?.status || "Not available"} subtext={health?.service || "nwis-api"} />
        </div>
        <div className="span-4">
          <Metric label="Risk records" value={formatValue(summary?.risk_records_generated)} subtext={summary?.note} />
        </div>
        <div className="span-12 pill-row">
          <Badge tone={summary?.m05_intelligence_available ? "outline" : "default"}>M0.5 {formatValue(summary?.m05_intelligence_available)}</Badge>
          <Badge tone={summary?.m06_statistical_models_available ? "outline" : "default"}>M0.6 {formatValue(summary?.m06_statistical_models_available)}</Badge>
          <Badge>M0.7 verified events {formatValue(summary?.m07_verified_historical_events_available)}</Badge>
          <Badge>Supervised labels {formatValue(summary?.supervised_event_labels_available)}</Badge>
        </div>
      </div>
    </Card>
  );
}
