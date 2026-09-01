import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import DataTable from "../ui/DataTable.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import { formatPercent, formatValue, modelDisplayName, safeArray, titleize } from "../../utils/format.js";
import "./dashboard.css";

export default function ModelEvidence({ records = [], prototype }) {
  const rows = records.map((record) => ({
    ...record,
    displayName: modelDisplayName(record.model_name),
  }));

  return (
    <Card>
      <SectionHeader
        title="M0.6 Model Evidence"
        description="Statistical model outputs are separated by model and are not physical event confirmations."
      />
      <DataTable
        rows={rows}
        columns={[
          { key: "displayName", header: "Model" },
          { key: "status", header: "Status", render: (row) => titleize(row.status) },
          { key: "label", header: "Output label", render: (row) => titleize(row.label) },
          { key: "score", header: "Score", render: (row) => formatValue(row.score) },
          { key: "confidence", header: "Confidence", render: (row) => formatPercent(row.confidence) },
          { key: "feature_coverage", header: "Coverage", render: (row) => formatPercent(row.feature_coverage) },
        ]}
        empty="No model records returned."
      />
      {prototype ? (
        <div className="state-panel" style={{ marginTop: "var(--space-lg)" }}>
          <div className="model-head">
            <div>
              <h3 className="state-title">Prototype Random Forest</h3>
              <p className="state-copy">SYNTHETIC DEMO · NOT REAL-WORLD VALIDATED · NOT USED IN CURRENT RISK SCORE</p>
            </div>
            <Badge tone="strong">{prototype.data_origin || "SYNTHETIC_DEMO"}</Badge>
          </div>
          <dl className="data-kv">
            <div><dt>Prediction</dt><dd>{titleize(prototype.prediction)}</dd></div>
            <div><dt>Probability</dt><dd>{formatPercent(prototype.probability)}</dd></div>
            <div><dt>Used in risk score</dt><dd>{formatValue(prototype.used_in_risk_score)}</dd></div>
            <div><dt>Validation status</dt><dd>{titleize(prototype.validation_status)}</dd></div>
          </dl>
        </div>
      ) : null}
    </Card>
  );
}
