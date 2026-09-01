import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import FeaturePanel from "../components/dashboard/FeaturePanel.jsx";
import Card from "../components/ui/Card.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { formatTimestamp, formatValue, latest, measurementRows } from "../utils/format.js";

export default function Features() {
  const { simulationMode, selectedTimestamp, selectedWell } = useAppState();
  const ts = simulationMode === "replay" ? selectedTimestamp : null;
  const telemetry = useApiResource(() => api.telemetry(ts ? { timestamp: ts, limit: 51 } : { limit: 51 }, selectedWell), [ts, selectedWell]);
  const featureEndpoint = useApiResource(() => api.features(ts ? { timestamp: ts, limit: 51 } : { limit: 51 }, selectedWell), [ts, selectedWell]);

  if (telemetry.state === "loading") return <LoadingState lines={5} />;
  if (telemetry.state === "error") return <ErrorState error={telemetry.error} />;

  const current = latest(telemetry.data.records || []);

  return (
    <div className="page">
      <PageHeader
        kicker="M0.4 feature engineering"
        title="Features"
        description="Raw current values and derived feature fields are separated. The FastAPI app does not expose a distinct features route."
      />

      {featureEndpoint.state === "error" ? (
        <Card>
          <SectionHeader title="Features Endpoint" description="No /features endpoint is present in the current M0.9 API." />
          <p className="state-copy">
            The page uses the M0.4-derived fields currently returned by /telemetry and does not fabricate missing API data.
          </p>
        </Card>
      ) : null}

      <Card>
        <SectionHeader
          title="Raw Telemetry Values"
          description={`Current values exposed inside the feature artifact at ${formatTimestamp(current?.timestamp)}.`}
        />
        <DataTable
          rows={measurementRows(current)}
          columns={[
            { key: "name", header: "Parameter" },
            { key: "value", header: "Current value", render: (row) => formatValue(row.value) },
            { key: "quality", header: "Status" },
          ]}
        />
      </Card>

      <FeaturePanel record={current} />
    </div>
  );
}
