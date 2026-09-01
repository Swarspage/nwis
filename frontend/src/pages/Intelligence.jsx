import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import EvidenceSummary from "../components/dashboard/EvidenceSummary.jsx";
import Card from "../components/ui/Card.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import Metric from "../components/ui/Metric.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { formatPercent, formatTimestamp, formatValue, latest, titleize } from "../utils/format.js";

export default function Intelligence() {
  const { simulationMode, selectedTimestamp, selectedWell } = useAppState();
  const ts = simulationMode === "replay" ? selectedTimestamp : null;
  const intelligence = useApiResource(() => api.intelligence(ts ? { timestamp: ts, limit: 51 } : { limit: 51 }, selectedWell), [ts, selectedWell]);

  if (intelligence.state === "loading") return <LoadingState lines={5} />;
  if (intelligence.state === "error") return <ErrorState error={intelligence.error} />;

  const records = intelligence.data.records || [];
  const current = latest(records);
  const qualityRows = Object.entries(current?.quality_flags || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="page">
      <PageHeader
        kicker="M0.5 deterministic intelligence"
        title="Intelligence"
        description="Anomaly and risk indicators are shown using backend terminology. Empty evidence remains empty."
      />

      <Card>
        <SectionHeader title="Current Intelligence Record" description={`Timestamp ${formatTimestamp(current?.timestamp)}`} />
        <div className="card-grid">
          <div className="span-3"><Metric label="Status" value={titleize(current?.intelligence_status)} /></div>
          <div className="span-3"><Metric label="Risk level" value={titleize(current?.risk_level)} /></div>
          <div className="span-3"><Metric label="Anomaly score" value={formatValue(current?.anomaly_score)} /></div>
          <div className="span-3"><Metric label="Confidence" value={formatPercent(current?.confidence)} /></div>
        </div>
      </Card>

      <EvidenceSummary intelligence={current} />

      <Card>
        <SectionHeader title="Quality Flags" description="Flags are presented directly from the intelligence payload." />
        <DataTable
          rows={qualityRows}
          columns={[
            { key: "name", header: "Flag", render: (row) => titleize(row.name) },
            { key: "value", header: "Value", render: (row) => formatValue(row.value) },
          ]}
          empty="No quality flags returned."
        />
      </Card>
    </div>
  );
}
