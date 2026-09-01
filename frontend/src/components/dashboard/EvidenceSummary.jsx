import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import { formatValue, safeArray, titleize } from "../../utils/format.js";
import "./dashboard.css";

export default function EvidenceSummary({ intelligence, risk }) {
  const evidence = safeArray(intelligence?.evidence || risk?.analytical_evidence?.m05?.evidence);

  return (
    <Card>
      <SectionHeader
        title="M0.5 Deterministic Evidence"
        description="Displayed as backend evidence, not translated into physical event labels."
        action={<Badge>{titleize(intelligence?.intelligence_status || risk?.analytical_evidence?.m05?.level)}</Badge>}
      />
      {evidence.length ? (
        <ul className="evidence-list">
          {evidence.map((item, index) => (
            <li className="evidence-item" key={`${item.feature || item.signal || "evidence"}-${index}`}>
              <p className="evidence-title">{titleize(item.feature || item.signal || `Evidence ${index + 1}`)}</p>
              <p className="evidence-copy">{formatValue(item)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No deterministic evidence at this timestamp">
          The API returned an empty evidence array for the selected record.
        </EmptyState>
      )}
    </Card>
  );
}
