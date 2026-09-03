import EmptyState from "../ui/EmptyState.jsx";
import { titleize } from "../../utils/format.js";
import { HiOutlineChartArea } from "react-icons/hi2";
import "./dashboard.css";

function pointsFor(records, field) {
  const values = records
    .map((record, index) => ({ index, value: record?.signal_features?.[field]?.current_value }))
    .filter((point) => typeof point.value === "number");

  if (!values.length) return { pointsStr: "", areaStr: "" };
  const min = Math.min(...values.map((point) => point.value));
  const max = Math.max(...values.map((point) => point.value));
  const range = max - min || 1;
  const last = Math.max(1, records.length - 1);

  const pts = values.map((point) => {
    const x = (point.index / last) * 100;
    const y = 95 - ((point.value - min) / range) * 85;
    return `${x},${y}`;
  });

  const pointsStr = pts.join(" ");
  const areaStr = `0,95 ${pointsStr} 100,95`;
  return { pointsStr, areaStr };
}

export default function TelemetryChart({ records = [], field = "standpipe_pressure", title = "Telemetry Trend" }) {
  const { pointsStr, areaStr } = pointsFor(records, field);

  return (
    <div className="chart-shell-light">
      <div className="chart-header-row">
        <div>
          <h3 className="chart-title">{title}</h3>
          <p className="chart-subtitle">{titleize(field)} from API-provided telemetry records.</p>
        </div>
        <HiOutlineChartArea style={{ fontSize: 22, color: "var(--color-signal-teal, #1E8A8A)" }} />
      </div>

      {pointsStr ? (
        <div className="chart-svg-container-light">
          <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${titleize(field)} trend`}>
            <defs>
              <linearGradient id="chartGradientLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E8A8A" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#1E8A8A" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            <line className="chart-axis-grid-light" x1="0" y1="20" x2="100" y2="20" />
            <line className="chart-axis-grid-light" x1="0" y1="50" x2="100" y2="50" />
            <line className="chart-axis-grid-light" x1="0" y1="80" x2="100" y2="80" />

            {/* Area Fill & Line */}
            <polygon className="chart-area-fill-light" points={areaStr} />
            <polyline className="chart-line-light" points={pointsStr} />
          </svg>
        </div>
      ) : (
        <EmptyState title="No plottable telemetry values">
          The selected field has no numeric values in the loaded API records.
        </EmptyState>
      )}
    </div>
  );
}
