import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import TelemetryChart from "../components/dashboard/TelemetryChart.jsx";
import Card from "../components/ui/Card.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { formatTimestamp, formatUnit, formatValue, latest, measurementRows } from "../utils/format.js";

export default function Telemetry() {
  const { simulationMode, selectedTimestamp, selectedWell } = useAppState();
  const ts = simulationMode === "replay" ? selectedTimestamp : null;
  const telemetry = useApiResource(() => api.telemetry(ts ? { timestamp: ts, limit: 51 } : { limit: 51 }, selectedWell), [ts, selectedWell]);

  if (telemetry.state === "loading") return <LoadingState lines={5} />;
  if (telemetry.state === "error") return <ErrorState error={telemetry.error} />;

  const records = telemetry.data.records || [];
  const current = latest(records);
  const rows = measurementRows(current);

  return (
    <div className="page">
      <PageHeader
        kicker="M0.4 API payload"
        title="Telemetry"
        description="Values are taken from the API-provided telemetry endpoint. Units are shown only when present in the contract."
      />

      <Card>
        <SectionHeader
          title="Current API Record"
          description={`Timestamp ${formatTimestamp(current?.timestamp)} · telemetry status ${current?.telemetry_status || "Not available"}`}
        />
        <DataTable
          rows={rows}
          columns={[
            { key: "name", header: "Parameter" },
            { key: "value", header: "Value", render: (row) => formatValue(row.value) },
            { key: "unit", header: "Unit", render: (row) => formatUnit(row.unit) },
            { key: "unit_status", header: "Unit status" },
            { key: "quality", header: "Quality" },
            { key: "source", header: "Source" },
          ]}
          empty="No telemetry values returned."
        />
      </Card>

      <Card>
        <TelemetryChart records={records} field="standpipe_pressure" title="Standpipe Pressure" />
      </Card>

      <Card>
        <TelemetryChart records={records} field="hookload" title="Hookload" />
      </Card>
    </div>
  );
}
