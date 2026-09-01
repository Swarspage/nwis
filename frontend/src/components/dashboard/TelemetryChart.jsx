import EmptyState from "../ui/EmptyState.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import { titleize } from "../../utils/format.js";
import "./dashboard.css";

function pointsFor(records, field) {
  const values = records
    .map((record, index) => ({ index, value: record?.signal_features?.[field]?.current_value }))
    .filter((point) => typeof point.value === "number");

  if (!values.length) return "";
  const min = Math.min(...values.map((point) => point.value));
  const max = Math.max(...values.map((point) => point.value));
  const range = max - min || 1;
  const last = Math.max(1, records.length - 1);

  return values
    .map((point) => {
      const x = (point.index / last) * 100;
      const y = 95 - ((point.value - min) / range) * 85;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function TelemetryChart({ records = [], field = "standpipe_pressure", title = "Telemetry Trend" }) {
  const points = pointsFor(records, field);

  return (
    <div className="chart-shell">
      <SectionHeader title={title} description={`${titleize(field)} from API-provided records.`} />
      {points ? (
        <svg className="chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${titleize(field)} trend`}>
          <line className="chart-axis" x1="0" y1="95" x2="100" y2="95" />
          <line className="chart-axis" x1="0" y1="10" x2="0" y2="95" />
          <polyline className="chart-line" points={points} />
        </svg>
      ) : (
        <EmptyState title="No plottable telemetry values">The selected field has no numeric values in the loaded API records.</EmptyState>
      )}
    </div>
  );
}
