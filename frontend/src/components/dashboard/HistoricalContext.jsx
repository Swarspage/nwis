import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import { formatValue } from "../../utils/format.js";
import { useAppState } from "../../app/AppState.jsx";

export default function HistoricalContext({ historical }) {
  const { selectedWell } = useAppState();
  const count = historical?.count ?? historical?.events?.length ?? 0;
  const isSynthetic = selectedWell !== "WELL-1";

  const description = isSynthetic
    ? `Verified historical events only. Historical evidence is unavailable for synthetic demo well ${selectedWell}.`
    : `Verified historical events only. Empty state is expected for ${selectedWell}.`;

  const emptyText = isSynthetic
    ? `Historical event evidence is unavailable for synthetic demo well ${selectedWell}. Simulation anomalies are not treated as historical ground truth.`
    : `No authoritative historical event documentation is currently available in the repository for ${selectedWell}. This is not an error.`;

  return (
    <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SectionHeader
        title="M0.7 Historical Context"
        description={description}
      />
      {count === 0 ? (
        <EmptyState title="NO VERIFIED HISTORICAL EVENTS AVAILABLE">
          {emptyText}
        </EmptyState>
      ) : (
        <dl className="data-kv">
          <div><dt>Events</dt><dd>{formatValue(count)}</dd></div>
          <div><dt>Status</dt><dd>{historical?.status || "OK"}</dd></div>
        </dl>
      )}
    </Card>
  );
}

