import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import EvidenceSummary from "../components/dashboard/EvidenceSummary.jsx";
import HistoricalContext from "../components/dashboard/HistoricalContext.jsx";
import ModelEvidence from "../components/dashboard/ModelEvidence.jsx";
import RiskSummary from "../components/dashboard/RiskSummary.jsx";
import SystemStatus from "../components/dashboard/SystemStatus.jsx";
import TelemetryChart from "../components/dashboard/TelemetryChart.jsx";
import Badge from "../components/ui/Badge.jsx";
import Card from "../components/ui/Card.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import Metric from "../components/ui/Metric.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import Timeline from "../components/ui/Timeline.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { formatTimestamp, latest } from "../utils/format.js";

export default function Overview() {
  const { simulationMode, selectedTimestamp, selectedWell } = useAppState();
  const ts = simulationMode === "replay" ? selectedTimestamp : null;

  const health = useApiResource(() => api.health(), []);
  const wells = useApiResource(() => api.wells(), []);
  const summary = useApiResource(() => api.summary(selectedWell), [selectedWell]);
  const risk = useApiResource(() => ts ? api.riskAt(ts, selectedWell) : api.currentRisk(selectedWell), [ts, selectedWell]);
  const timelineData = useApiResource(() => api.riskTimeline({ limit: 51 }, selectedWell), [selectedWell]); // Timeline spans historical range
  const telemetry = useApiResource(() => api.telemetry(ts ? { timestamp: ts, limit: 51 } : { limit: 51 }, selectedWell), [ts, selectedWell]);
  const intelligence = useApiResource(() => api.intelligence(ts ? { timestamp: ts, limit: 51 } : { limit: 51 }, selectedWell), [ts, selectedWell]);
  const models = useApiResource(() => api.models(ts ? { timestamp: ts, limit: 153 } : { limit: 153 }, selectedWell), [ts, selectedWell]);
  const historical = useApiResource(() => api.historicalEvents(selectedWell), [selectedWell]);

  const loading = [health, wells, summary, risk, timelineData, telemetry, intelligence, models, historical].some((r) => r.state === "loading");
  const error = [health, wells, summary, risk, timelineData, telemetry, intelligence, models, historical].find((r) => r.state === "error");

  if (loading) return <LoadingState lines={6} />;
  if (error) return <ErrorState error={error.error} />;

  const records = timelineData.data.records || [];
  const latestTimestamp = risk.data.timestamp;
  const latestModels = (models.data.records || []).filter((record) => record.timestamp === latestTimestamp);
  const latestTelemetry = latest(telemetry.data.records || []);
  const latestIntelligence = latest(intelligence.data.records || []);

  return (
    <div className="page">
      <PageHeader
        kicker="Operational replay · WELL-1"
        title="NWIS monitoring overview"
        description="Read-only presentation dashboard over the M0.9 FastAPI backend. Replay data is displayed as historical-source evidence."
      />

      <RiskSummary risk={risk.data} />

      <SystemStatus summary={summary.data} health={health.data} well={wells.data.wells?.[0]} />

      <div className="card-grid">
        <div className="span-6">
          <EvidenceSummary intelligence={latestIntelligence} risk={risk.data} />
        </div>
        <div className="span-6">
          <HistoricalContext historical={historical.data} />
        </div>
      </div>

      <ModelEvidence records={latestModels} prototype={risk.data.prototype_supervised} />

      <Card>
        <SectionHeader
          title="Replay Availability"
          description="Chronological risk records loaded from the backend timeline."
          action={<Badge tone="outline">{records.length} records</Badge>}
        />
        <Timeline
          index={records.findIndex((r) => r.timestamp === latestTimestamp) || Math.max(0, records.length - 1)}
          count={records.length}
          start={records[0]?.timestamp}
          end={records[records.length - 1]?.timestamp}
        />
        <div className="card-grid" style={{ marginTop: "var(--space-xl)" }}>
          <div className="span-4"><Metric label="Current timestamp" value={formatTimestamp(latestTimestamp)} /></div>
          <div className="span-4"><Metric label="Telemetry status" value={latestTelemetry?.telemetry_status || "Not available"} /></div>
          <div className="span-4"><Metric label="Data mode" value={simulationMode === "replay" ? "Replay" : "Live"} subtext="Default mode avoids implying live telemetry." /></div>
        </div>
      </Card>

      <Card>
        <TelemetryChart records={telemetry.data.records || []} field="standpipe_pressure" title="Standpipe Pressure Trend" />
      </Card>
    </div>
  );
}
