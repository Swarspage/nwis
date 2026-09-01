import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import { useAppState } from "../app/AppState.jsx";
import HistoricalContext from "../components/dashboard/HistoricalContext.jsx";
import Card from "../components/ui/Card.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";

export default function Historical() {
  const { selectedWell } = useAppState();
  const historical = useApiResource(() => api.historicalEvents(selectedWell), [selectedWell]);

  if (historical.state === "loading") return <LoadingState lines={5} />;
  if (historical.state === "error") return <ErrorState error={historical.error} />;

  return (
    <div className="page">
      <PageHeader
        kicker="M0.7 historical knowledge"
        title="Historical context"
        description="This page intentionally displays zero verified historical events for WELL-1 when the backend reports none."
      />

      <HistoricalContext historical={historical.data} />

      <Card>
        <SectionHeader title="Verified Event Records" description="Future historical records can render here without changing the page structure." />
        <DataTable
          rows={historical.data.events || []}
          columns={[
            { key: "event_id", header: "Event ID" },
            { key: "event_type", header: "Event type" },
            { key: "verification_status", header: "Verification" },
            { key: "timestamp", header: "Timestamp" },
          ]}
          empty="No verified historical event records returned by the API."
        />
      </Card>
    </div>
  );
}
