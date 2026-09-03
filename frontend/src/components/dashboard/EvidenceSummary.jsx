import Badge from "../ui/Badge.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { safeArray, titleize } from "../../utils/format.js";
import { HiOutlineArrowUpRight } from "react-icons/hi2";
import "./dashboard.css";

function EvidenceItemCard({ item, index, onClick }) {
  if (typeof item !== "object" || item === null) {
    return (
      <li className="evidence-item-card-light" key={`evidence-${index}`} onClick={onClick}>
        <p className="evidence-desc">{String(item)}</p>
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
      className="evidence-item-card-light"
      key={`${rawFeature}-${index}`}
      onClick={onClick}
      title="Click to view deep evidence inspection"
    >
      <div className="evidence-item-header">
        <span className="evidence-title-text">{featureLabel}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {direction && (
            <span className={`evidence-badge ${isHigh ? "high" : "normal"}`}>
              {direction}
            </span>
          )}
          <HiOutlineArrowUpRight style={{ fontSize: 14, color: "var(--color-mute, #8C99A6)" }} />
        </div>
      </div>

      <div className="evidence-metrics-row">
        {contribution && (
          <div className="metric-pill-item">
            <span className="metric-pill-label">Contribution:</span>
            <span className="metric-pill-val">{contribution}</span>
          </div>
        )}

        {zScore && (
          <div className="metric-pill-item">
            <span className="metric-pill-label">Z-Score:</span>
            <span className="metric-pill-val" style={{ color: isHigh ? "var(--color-rust, #B3261E)" : "var(--color-signal-teal, #1E8A8A)" }}>
              {zScore}
            </span>
          </div>
        )}
      </div>

      {item.explanation && <p className="evidence-desc">{item.explanation}</p>}
    </li>
  );
}

export default function EvidenceSummary({ intelligence, risk, onSelectEvidence }) {
  const evidence = safeArray(intelligence?.evidence || risk?.analytical_evidence?.m05?.evidence);

  return (
    <div className="dashboard-card-light" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-ink, #0A2540)", fontFamily: "var(--font-display)" }}>
            M0.5 Deterministic Evidence
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-body, #5B6B7A)" }}>
            Displayed as backend evidence, not translated into physical event labels.
          </p>
        </div>
        <Badge>{titleize(intelligence?.intelligence_status || risk?.analytical_evidence?.m05?.level)}</Badge>
      </div>

      {evidence.length ? (
        <ul className="evidence-list" style={{ flex: 1 }}>
          {evidence.map((item, index) => (
            <EvidenceItemCard
              item={item}
              index={index}
              key={index}
              onClick={() => onSelectEvidence && onSelectEvidence(item)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState title="No deterministic evidence at this timestamp">
          The API returned an empty evidence array for the selected record.
        </EmptyState>
      )}
    </div>
  );
}
