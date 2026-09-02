/**
 * EvidenceDrawer — Right-side slide-over panel for deep evidence inspection.
 *
 * Opened from: Intelligence evidence cards, Risk drivers, Telemetry anomaly markers.
 *
 * Structure:
 *   1. Signal header (feature key + direction)
 *   2. Signal metrics (value, z-score, contribution)
 *   3. Model evidence (which M0.6 models flag this)
 *   4. Data provenance
 *   5. Engineering review note (cautious language only)
 *
 * Props:
 *   open      — boolean
 *   onClose   — function
 *   evidence  — evidence item from API (feature, direction, contribution, z_score, explanation)
 *   models    — array of M0.6 model records (to find model references to this feature)
 *   telemetry — current telemetry record (for live channel value)
 */
import { useEffect } from "react";
import { titleize } from "../../utils/format.js";

function DrawerSection({ title, children }) {
  return (
    <div style={{ borderTop: "1px solid var(--color-hairline)", paddingTop: "var(--space-md)" }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label-sm)",
          fontWeight: "var(--weight-medium)",
          color: "var(--color-mute)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "var(--space-sm)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value, mono = false }) {
  return (
    <div style={{ marginBottom: "var(--space-xs)" }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "11px",
          color: "var(--color-mute)",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? "var(--font-code)" : "var(--font-body)",
          fontSize: mono ? "var(--text-data-sm)" : "var(--text-body-sm)",
          color: "var(--color-ink)",
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

export default function EvidenceDrawer({ open, onClose, evidence, models = [], telemetry }) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !evidence) return null;

  const featureKey = evidence.feature || evidence.signal || evidence.name || "";
  const featureLabel = featureKey
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const isHigh = evidence.direction === "HIGH" || evidence.direction === "ELEVATED";
  const directionColor = isHigh ? "var(--color-rust)" : "var(--color-signal-teal)";

  // Find M0.6 model evidence for this feature
  const modelEvidence = models.flatMap((m) =>
    (m.evidence || [])
      .filter((e) => (e.feature || "").includes(featureKey) || featureKey.includes(e.feature || ""))
      .map((e) => ({ model: m.model_name, ...e }))
  );

  // Live channel value from telemetry
  const channelValue = telemetry?.measurements?.[featureKey]?.value;
  const channelUnit = telemetry?.measurements?.[featureKey]?.unit;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10,37,64,0.12)",
          zIndex: 200,
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "clamp(320px, 38vw, 480px)",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-hairline)",
          boxShadow: "-4px 0 24px rgba(10,37,64,0.10)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          animation: "slide-in var(--motion-slow) var(--ease-emphasis)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "var(--space-lg)",
            borderBottom: "1px solid var(--color-hairline)",
            background: "var(--color-canvas)",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-sm)" }}>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-label-sm)",
                  color: "var(--color-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                Evidence Detail
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-heading-md)",
                  fontWeight: "var(--weight-medium)",
                  color: "var(--color-ink)",
                  lineHeight: 1.3,
                }}
              >
                {featureLabel}
              </div>
              {evidence.direction && (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontFamily: "var(--font-code)",
                    fontSize: "10px",
                    fontWeight: "var(--weight-medium)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-pill)",
                    background: isHigh ? "rgba(179,38,30,0.1)" : "rgba(30,138,138,0.1)",
                    color: directionColor,
                  }}
                >
                  {evidence.direction}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-mute)",
                fontSize: 18,
                lineHeight: 1,
                padding: 4,
                borderRadius: "var(--radius-sm)",
                flexShrink: 0,
              }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "var(--space-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
          }}
        >
          {/* Current Signal */}
          <DrawerSection title="Current Signal">
            {channelValue !== undefined && channelValue !== null ? (
              <div style={{ display: "flex", gap: "var(--space-lg)", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-mute)", marginBottom: 2 }}>Live Value</div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-md)", color: "var(--color-ink)" }}>
                    {typeof channelValue === "number" ? channelValue.toFixed(2) : channelValue}
                    {channelUnit ? ` ${channelUnit}` : ""}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)", margin: 0, fontStyle: "italic" }}>
                Channel value not available in current telemetry.
              </p>
            )}
          </DrawerSection>

          {/* M0.5 Evidence Metrics */}
          <DrawerSection title="M0.5 Deterministic Evidence">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
              {evidence.contribution != null && (
                <KV
                  label="Contribution"
                  value={`${(evidence.contribution * 100).toFixed(1)}%`}
                  mono
                />
              )}
              {evidence.z_score != null && (
                <KV
                  label="Z-Score"
                  value={evidence.z_score >= 0 ? `+${evidence.z_score.toFixed(2)}` : evidence.z_score.toFixed(2)}
                  mono
                />
              )}
            </div>
            {evidence.explanation && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-body)",
                  lineHeight: "var(--leading-body-sm)",
                  margin: "var(--space-sm) 0 0",
                }}
              >
                {evidence.explanation}
              </p>
            )}
          </DrawerSection>

          {/* M0.6 Model Evidence */}
          <DrawerSection title="M0.6 Model Evidence">
            {modelEvidence.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {modelEvidence.map((me, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--color-surface-sunken)",
                      border: "1px solid var(--color-hairline)",
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 10px",
                      display: "flex",
                      gap: "var(--space-md)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-slate)", fontWeight: "var(--weight-medium)" }}>
                      {titleize(me.model)}
                    </span>
                    {me.contribution != null && (
                      <span style={{ fontFamily: "var(--font-code)", fontSize: "11px", color: "var(--color-ink)" }}>
                        {(me.contribution * 100).toFixed(1)}%
                      </span>
                    )}
                    {me.direction && (
                      <span style={{ fontFamily: "var(--font-code)", fontSize: "10px", color: me.direction === "HIGH" ? "var(--color-rust)" : "var(--color-signal-teal)" }}>
                        {me.direction}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)", margin: 0, fontStyle: "italic" }}>
                No M0.6 model evidence cross-references this feature.
              </p>
            )}
          </DrawerSection>

          {/* Data Provenance */}
          <DrawerSection title="Data Provenance">
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", margin: 0, lineHeight: "var(--leading-body-sm)" }}>
              This evidence was generated by M0.5 deterministic intelligence from the M0.4 canonical feature payload. 
              Feature key: <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-sm)", color: "var(--color-ink)" }}>{featureKey || "—"}</span>.
            </p>
          </DrawerSection>

          {/* Engineering Review */}
          <DrawerSection title="Engineering Review">
            <div
              style={{
                background: "var(--color-canvas-deep)",
                border: "1px solid var(--color-hairline)",
                borderLeft: "3px solid var(--color-slate)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
              }}
            >
              <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", margin: 0, lineHeight: "var(--leading-body-sm)" }}>
                Review current {featureLabel.toLowerCase()} behaviour in context with related parameters.
                Anomaly scores are statistical observations — not confirmed drilling events.
                Engineering judgement is required.
              </p>
            </div>
          </DrawerSection>
        </div>
      </div>
    </>
  );
}
