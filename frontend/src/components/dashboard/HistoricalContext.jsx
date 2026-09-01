import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import { formatValue } from "../../utils/format.js";

export default function HistoricalContext({ historical }) {
  const count = historical?.count ?? historical?.events?.length ?? 0;

  return (
    <Card>
      <SectionHeader
        title="M0.7 Historical Context"
        description="Verified historical events only. Empty state is expected for WELL-1."
      />
      {count === 0 ? (
        <EmptyState title="NO VERIFIED HISTORICAL EVENTS AVAILABLE">
          No authoritative historical event documentation is currently available in the repository. This is not an error.
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
