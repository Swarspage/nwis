import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import ModelEvidence from "../components/dashboard/ModelEvidence.jsx";
import Card from "../components/ui/Card.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { formatTimestamp, latest, modelDisplayName, safeArray, titleize } from "../utils/format.js";

export default function Models() {
  const { simulationMode, selectedTimestamp, selectedWell } = useAppState();
  const ts = simulationMode === "replay" ? selectedTimestamp : null;
  const models = useApiResource(() => api.models(ts ? { timestamp: ts, limit: 153 } : { limit: 153 }, selectedWell), [ts, selectedWell]);
  const risk = useApiResource(() => ts ? api.riskAt(ts, selectedWell) : api.currentRisk(selectedWell), [ts, selectedWell]);

  if (models.state === "loading" || risk.state === "loading") return <LoadingState lines={5} />;
  if (models.state === "error") return <ErrorState error={models.error} />;
  if (risk.state === "error") return <ErrorState error={risk.error} />;

  const records = models.data.records || [];
  const currentTimestamp = risk.data.timestamp || latest(records)?.timestamp;
  const currentRecords = records.filter((record) => record.timestamp === currentTimestamp);
  const evidenceRows = currentRecords.flatMap((record) =>
    safeArray(record.evidence).map((item, index) => ({
      id: `${record.model_name}-${index}`,
      model: modelDisplayName(record.model_name),
      ...item,
    })),
  );

  return (
    <div className="page">
      <PageHeader
        kicker="M0.6 statistical models"
        title="Models"
        description="Isolation Forest, K-Means behavioral state, and temporal baseline outputs are separated as analytical evidence."
      />

      <ModelEvidence records={currentRecords} prototype={risk.data.prototype_supervised} />

      <Card>
        <SectionHeader title="Current Model Evidence Rows" description={`Timestamp ${formatTimestamp(currentTimestamp)}`} />
        <DataTable
          rows={evidenceRows}
          columns={[
            { key: "model", header: "Model" },
            { key: "feature", header: "Feature", render: (row) => titleize(row.feature) },
            { key: "contribution", header: "Contribution" },
            { key: "direction", header: "Direction", render: (row) => titleize(row.direction) },
          ]}
          empty="No evidence rows returned for the current model records."
        />
      </Card>
    </div>
  );
}
