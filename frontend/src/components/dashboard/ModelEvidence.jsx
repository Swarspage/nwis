import Badge from "../ui/Badge.jsx";
import { formatPercent, formatValue, modelDisplayName, titleize } from "../../utils/format.js";
import { HiOutlineCpuChip } from "react-icons/hi2";
import "./dashboard.css";

export default function ModelEvidence({ records = [], prototype }) {
  const rows = records.map((record) => ({
    ...record,
    displayName: modelDisplayName(record.model_name),
  }));

  return (
    <div className="dashboard-card-light">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-ink, #0A2540)", fontFamily: "var(--font-display)" }}>
            M0.6 Model Evidence
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-body, #5B6B7A)" }}>
            Statistical model outputs are separated by model and are not physical event confirmations.
          </p>
        </div>
        <HiOutlineCpuChip style={{ fontSize: 22, color: "var(--color-signal-teal, #1E8A8A)" }} />
      </div>

      <div className="light-table-container">
        <table className="light-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Status</th>
              <th>Output Label</th>
              <th>Score</th>
              <th>Confidence</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--color-ink, #0A2540)" }}>{row.displayName}</td>
                  <td>
                    <span className="evidence-badge normal">{titleize(row.status)}</span>
                  </td>
                  <td className="light-table-code">{titleize(row.label)}</td>
                  <td style={{ fontFamily: "var(--font-code)", fontWeight: 700, color: "var(--color-signal-teal, #1E8A8A)" }}>
                    {formatValue(row.score)}
                  </td>
                  <td style={{ fontFamily: "var(--font-code)" }}>{formatPercent(row.confidence)}</td>
                  <td style={{ fontFamily: "var(--font-code)" }}>{formatPercent(row.feature_coverage)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--color-mute, #8C99A6)", padding: 20 }}>
                  No model records returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {prototype && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-hairline, #DFE6E3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-ink, #0A2540)" }}>
                Prototype Random Forest
              </h4>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--color-brass, #C77A2E)", letterSpacing: "0.03em" }}>
                SYNTHETIC DEMO · NOT REAL-WORLD VALIDATED · NOT USED IN CURRENT RISK SCORE
              </p>
            </div>
            <Badge tone="strong">{prototype.data_origin || "SYNTHETIC_DEMO"}</Badge>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            <div className="metric-card-light">
              <div className="metric-card-label">Prediction</div>
              <div className="metric-card-value">{titleize(prototype.prediction)}</div>
            </div>
            <div className="metric-card-light">
              <div className="metric-card-label">Probability</div>
              <div className="metric-card-value">{formatPercent(prototype.probability)}</div>
            </div>
            <div className="metric-card-light">
              <div className="metric-card-label">Used In Risk Score</div>
              <div className="metric-card-value">{formatValue(prototype.used_in_risk_score)}</div>
            </div>
            <div className="metric-card-light">
              <div className="metric-card-label">Validation</div>
              <div className="metric-card-value">{titleize(prototype.validation_status)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
