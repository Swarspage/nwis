import { useEffect } from "react";
import { titleize } from "../../utils/format.js";
import { HiXMark } from "react-icons/hi2";
import "./dashboard.css";

function DrawerSection({ title, children }) {
  return (
    <div className="drawer-section-card-light">
      <div className="drawer-section-title-light">{title}</div>
      {children}
    </div>
  );
}

function KV({ label, value, mono = false }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: "var(--color-slate, #3E5164)", marginBottom: 2 }}>{label}</div>
      <div
        style={{
          fontFamily: mono ? "var(--font-code)" : "var(--font-body)",
          fontSize: mono ? 13 : 13.5,
          fontWeight: 600,
          color: "var(--color-ink, #0A2540)",
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
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
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
          background: "rgba(10, 37, 64, 0.25)",
          backdropFilter: "blur(2px)",
          zIndex: 290,
        }}
      />

      {/* Drawer panel */}
      <div className="evidence-drawer-light">
        {/* Header */}
        <div className="drawer-header-light">
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-slate, #3E5164)", marginBottom: 4 }}>
              Deep Inspection
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--color-ink, #0A2540)", fontFamily: "var(--font-display)" }}>
              {featureLabel}
            </h3>
            {evidence.direction && (
              <span
                className={`evidence-badge ${isHigh ? "high" : "normal"}`}
                style={{ marginTop: 6, display: "inline-block" }}
              >
                {evidence.direction}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="drawer-close-btn-light" title="Close (Esc)">
            <HiXMark />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {/* Current Signal */}
          <DrawerSection title="Current Telemetry Signal">
            {channelValue !== undefined && channelValue !== null ? (
              <div style={{ display: "flex", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--color-slate, #3E5164)" }}>Live Value</div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 16, fontWeight: 700, color: "var(--color-signal-teal, #1E8A8A)" }}>
                    {typeof channelValue === "number" ? channelValue.toFixed(2) : channelValue}
                    {channelUnit ? ` ${channelUnit}` : ""}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-mute, #8C99A6)", fontStyle: "italic" }}>
                Channel value not available in current telemetry payload.
              </p>
            )}
          </DrawerSection>

          {/* M0.5 Evidence Metrics */}
          <DrawerSection title="M0.5 Deterministic Evidence">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
              <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--color-body, #5B6B7A)", lineHeight: 1.5 }}>
                {evidence.explanation}
              </p>
            )}
          </DrawerSection>

          {/* M0.6 Model Evidence */}
          <DrawerSection title="M0.6 Statistical Model Cross-Reference">
            {modelEvidence.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {modelEvidence.map((me, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--color-surface, #FFFFFF)",
                      border: "1px solid var(--color-hairline, #DFE6E3)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink, #0A2540)" }}>
                      {titleize(me.model)}
                    </span>
                    {me.contribution != null && (
                      <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--color-signal-teal, #1E8A8A)", fontWeight: 600 }}>
                        {(me.contribution * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-mute, #8C99A6)", fontStyle: "italic" }}>
                No M0.6 model evidence cross-references this feature.
              </p>
            )}
          </DrawerSection>

          {/* Data Provenance */}
          <DrawerSection title="Data Provenance">
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-body, #5B6B7A)", lineHeight: 1.5 }}>
              Generated by M0.5 deterministic intelligence from M0.4 feature key:{" "}
              <span style={{ fontFamily: "var(--font-code)", color: "var(--color-signal-teal, #1E8A8A)", fontWeight: 600 }}>{featureKey || "—"}</span>.
            </p>
          </DrawerSection>

          {/* Engineering Review */}
          <DrawerSection title="Engineering Guidance">
            <div
              style={{
                background: "var(--color-signal-teal-soft, #E3F2F0)",
                border: "1px solid rgba(30, 138, 138, 0.3)",
                borderLeft: "3px solid var(--color-signal-teal, #1E8A8A)",
                borderRadius: 6,
                padding: "10px 12px",
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-ink, #0A2540)", lineHeight: 1.5 }}>
                Review current {featureLabel.toLowerCase()} behavior in context with related parameters.
                Anomaly scores are statistical observations — not confirmed drilling events.
              </p>
            </div>
          </DrawerSection>
        </div>
      </div>
    </>
  );
}
