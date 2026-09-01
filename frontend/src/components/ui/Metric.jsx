import "./ui.css";

export default function Metric({ label, value, subtext }) {
  return (
    <div className="metric">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {subtext ? <p className="metric-subtext">{subtext}</p> : null}
    </div>
  );
}
