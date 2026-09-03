import { formatValue, titleize } from "../../utils/format.js";
import { HiOutlineSquare3Stack3D } from "react-icons/hi2";
import "./dashboard.css";

export default function FeaturePanel({ record }) {
  const qualityRows = Object.entries(record?.quality_features || {}).map(([name, value]) => ({ name, value, group: "Quality" }));
  const relationshipRows = Object.entries(record?.relationship_features || {}).map(([name, value]) => ({ name, value, group: "Relationship" }));
  const stateRows = Object.entries(record?.state_features || {})
    .slice(0, 24)
    .map(([name, value]) => ({ name, value, group: "State" }));

  const rows = [...qualityRows, ...relationshipRows, ...stateRows];

  return (
    <div className="dashboard-card-light">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-ink, #0A2540)", fontFamily: "var(--font-display)" }}>
            Derived Features
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-body, #5B6B7A)" }}>
            M0.4 feature values exposed through current telemetry payload.
          </p>
        </div>
        <HiOutlineSquare3Stack3D style={{ fontSize: 20, color: "var(--color-signal-teal, #1E8A8A)" }} />
      </div>

      <div className="light-table-container">
        <table className="light-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Feature</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, idx) => (
                <tr key={`${row.name}-${idx}`}>
                  <td style={{ color: "var(--color-body, #5B6B7A)", fontSize: 12 }}>{row.group}</td>
                  <td className="light-table-code">{titleize(row.name)}</td>
                  <td style={{ fontFamily: "var(--font-code)", fontWeight: 600 }}>{formatValue(row.value)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--color-mute, #8C99A6)", padding: 20 }}>
                  No derived feature fields were returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
