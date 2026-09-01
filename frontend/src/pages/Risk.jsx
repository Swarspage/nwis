import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import RiskSummary from "../components/dashboard/RiskSummary.jsx";
import Card from "../components/ui/Card.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import Metric from "../components/ui/Metric.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { formatPercent, formatTimestamp, formatValue, titleize } from "../utils/format.js";

export default function Risk() {
  const { selectedTimestamp, selectedWell } = useAppState();
  const ts = selectedTimestamp;
  const risk = useApiResource(() => ts ? api.riskAt(ts, selectedWell) : api.currentRisk(selectedWell), [ts, selectedWell]);

  if (risk.state === "loading") return <LoadingState lines={5} />;
  if (risk.state === "error") return <ErrorState error={risk.error} />;

  const analytical = risk.data.analytical_evidence || {};
  const fusion = analytical.fusion_metadata || {};
  const contributionRows = [
    { layer: "M0.5 deterministic intelligence", ...analytical.m05 },
    { layer: "M0.6 statistical models", ...analytical.m06 },
  ];
  const weightRows = Object.entries(fusion.configured_weights || {}).map(([layer, configured]) => ({
    layer: layer.toUpperCase(),
    configured,
    effective: fusion.effective_weights?.[layer],
  }));

  return (
    <div className="page">
      <PageHeader
        kicker="Risk fusion"
        title="Risk analysis"
        description="Fusion metadata and evidence are displayed without claiming predictive accuracy or operational validation."
      />

      <RiskSummary risk={risk.data} />

      <Card>
        <SectionHeader title="Risk Metadata" description={`Risk record at ${formatTimestamp(risk.data.timestamp)}`} />
        <div className="card-grid">
          <div className="span-3"><Metric label="Risk level" value={titleize(risk.data.risk_level)} /></div>
          <div className="span-3"><Metric label="Alert state" value={formatValue(risk.data.alert)} /></div>
          <div className="span-3"><Metric label="Confidence" value={formatPercent(risk.data.confidence)} /></div>
          <div className="span-3"><Metric label="Origin" value={risk.data.data_origin || "Unknown"} /></div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Layer Contributions" description="Availability, scores, confidence, and alerts from analytical layers." />
        <DataTable
          rows={contributionRows}
          columns={[
            { key: "layer", header: "Layer" },
            { key: "available", header: "Available", render: (row) => formatValue(row.available) },
            { key: "score", header: "Score", render: (row) => formatValue(row.score) },
            { key: "level", header: "Level", render: (row) => titleize(row.level) },
            { key: "confidence", header: "Confidence", render: (row) => formatPercent(row.confidence) },
            { key: "alert", header: "Alert", render: (row) => formatValue(row.alert) },
          ]}
        />
      </Card>

      <Card>
        <SectionHeader title="Fusion Weights" description="Configured and effective layer weights returned by the backend." />
        <DataTable
          rows={weightRows}
          columns={[
            { key: "layer", header: "Layer" },
            { key: "configured", header: "Configured", render: (row) => formatValue(row.configured) },
            { key: "effective", header: "Effective", render: (row) => formatValue(row.effective) },
          ]}
        />
      </Card>
    </div>
  );
}
