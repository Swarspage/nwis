import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import SectionHeader from "../ui/SectionHeader.jsx";
import { formatValue, safeArray, titleize } from "../../utils/format.js";
import "./dashboard.css";

function EvidenceItemCard({ item, index }) {
  if (typeof item !== "object" || item === null) {
    return (
      <li className="evidence-item" key={`evidence-${index}`}>
        <p className="evidence-copy">{String(item)}</p>
      </li>
    );
  }

  const rawFeature = item.feature || item.signal || item.name || `Evidence ${index + 1}`;
  const featureLabel = rawFeature
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const direction = item.direction;
  const contribution = item.contribution != null ? (item.contribution * 100).toFixed(1) + "%" : null;
  const zScore =
    item.z_score != null
      ? item.z_score >= 0
        ? `+${item.z_score.toFixed(2)}`
        : item.z_score.toFixed(2)
      : null;

  const isHigh = direction === "HIGH" || direction === "ELEVATED";

  return (
    <li
      className="evidence-item"
      key={`${rawFeature}-${index}`}
      style={{
        background: "var(--color-surface-sunken)",
        border: "1px solid var(--color-hairline)",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
        margin: "0 0 8px 0",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--color-ink)",
          }}
        >
          {featureLabel}
        </span>
        {direction && (
          <span
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "10px",
              fontWeight: "var(--weight-medium)",
              padding: "2px 8px",
              borderRadius: "var(--radius-pill)",
              background: isHigh ? "rgba(179,38,30,0.12)" : "rgba(30,138,138,0.12)",
              color: isHigh ? "var(--color-rust)" : "var(--color-signal-teal)",
              letterSpacing: "0.04em",
            }}
          >
            {direction}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 2 }}>
        {contribution && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-mute)" }}>
              Contribution:
            </span>
            <span style={{ fontFamily: "var(--font-code)", fontSize: "11px", fontWeight: "var(--weight-medium)", color: "var(--color-ink)" }}>
              {contribution}
            </span>
          </div>
        )}

        {zScore && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-mute)" }}>
              Z-score:
            </span>
            <span style={{ fontFamily: "var(--font-code)", fontSize: "11px", fontWeight: "var(--weight-medium)", color: isHigh ? "var(--color-rust)" : "var(--color-signal-teal)" }}>
              {zScore}
            </span>
          </div>
        )}
      </div>

      {item.explanation && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-body)", margin: "2px 0 0", lineHeight: 1.4 }}>
          {item.explanation}
        </p>
      )}
    </li>
  );
}

export default function EvidenceSummary({ intelligence, risk }) {
  const evidence = safeArray(intelligence?.evidence || risk?.analytical_evidence?.m05?.evidence);

  return (
    <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SectionHeader
        title="M0.5 Deterministic Evidence"
        description="Displayed as backend evidence, not translated into physical event labels."
        action={<Badge>{titleize(intelligence?.intelligence_status || risk?.analytical_evidence?.m05?.level)}</Badge>}
      />
      {evidence.length ? (
        <ul className="evidence-list" style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
          {evidence.map((item, index) => (
            <EvidenceItemCard item={item} index={index} key={index} />
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
