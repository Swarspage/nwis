import Card from "../ui/Card.jsx";
import DataTable from "../ui/DataTable.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import { formatValue, titleize } from "../../utils/format.js";

export default function FeaturePanel({ record }) {
  const qualityRows = Object.entries(record?.quality_features || {}).map(([name, value]) => ({ name, value, group: "Quality" }));
  const relationshipRows = Object.entries(record?.relationship_features || {}).map(([name, value]) => ({ name, value, group: "Relationship" }));
  const stateRows = Object.entries(record?.state_features || {})
    .slice(0, 24)
    .map(([name, value]) => ({ name, value, group: "State" }));

  return (
    <Card>
      <SectionHeader
        title="Derived Features"
        description="M0.4 feature values exposed through the current API telemetry payload."
      />
      <DataTable
        rows={[...qualityRows, ...relationshipRows, ...stateRows]}
        columns={[
          { key: "group", header: "Group" },
          { key: "name", header: "Feature", render: (row) => titleize(row.name) },
          { key: "value", header: "Value", render: (row) => formatValue(row.value) },
        ]}
        empty="No derived feature fields were returned."
      />
    </Card>
  );
}
