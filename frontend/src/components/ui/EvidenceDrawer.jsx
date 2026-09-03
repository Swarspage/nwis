import { motion, AnimatePresence } from "framer-motion";
import Badge from "./Badge.jsx";
import DataQualityBadge from "./DataQualityBadge.jsx";

export default function EvidenceDrawer({ event, isOpen, onClose, onNavigateHistorical }) {
  if (!isOpen || !event) return null;

  const isConfirmed = event.confirmation_status === "CONFIRMED";
  const isSynthetic = event.data_origin === "SYNTHETIC_DEMO";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(6, 22, 39, 0.75)",
          backdropFilter: "blur(4px)",
          zIndex: 100,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "440px",
            maxWidth: "90vw",
            height: "100%",
            background: "var(--color-surface)",
            borderLeft: "1px solid var(--color-hairline)",
            boxShadow: "-8px 0 24px rgba(0, 0, 0, 0.4)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* DRAWER HEADER */}
          <div
            style={{
              padding: "var(--space-md)",
              borderBottom: "1px solid var(--color-hairline)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              background: "var(--color-surface-sunken)",
            }}
          >
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
                M0.7 Historical Evidence Record
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-heading-md)",
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--color-ink)",
                  margin: 0,
                }}
              >
                {event.event_id || "HISTORICAL EVENT"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="button button-ghost"
              style={{ padding: "4px 8px", fontSize: "14px" }}
            >
              ✕
            </button>
          </div>

          {/* DRAWER CONTENT */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "var(--space-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-md)",
            }}
          >
            {/* EVENT STATUS */}
            <div
              style={{
                display: "flex",
                gap: "var(--space-xs)",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                className={`badge ${isConfirmed ? "badge-moss" : "badge-outline"}`}
              >
                {event.confirmation_status || "UNCONFIRMED"}
              </span>
              {isSynthetic ? (
                <DataQualityBadge status="synthetic" />
              ) : (
                <span className="badge badge-brass">
                  {event.data_origin || "HISTORICAL_SOURCE"}
                </span>
              )}
            </div>

            {/* SECTION: EVENT TYPE */}
            <div>
              <div className="section-label" style={{ marginBottom: "var(--space-xs)" }}>
                EVENT TYPE & TAXONOMY
              </div>
              <dl className="data-kv">
                <div>
                  <dt>Event Type</dt>
                  <dd>{event.event_type || "UNKNOWN"}</dd>
                </div>
                <div>
                  <dt>Confirmation Status</dt>
                  <dd>{event.confirmation_status || "UNCONFIRMED"}</dd>
                </div>
                {event.validation_status && (
                  <div>
                    <dt>Validation Status</dt>
                    <dd>{event.validation_status}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* SECTION: TEMPORAL BOUNDS */}
            <div>
              <div className="section-label" style={{ marginBottom: "var(--space-xs)" }}>
                TEMPORAL BOUNDS
              </div>
              <dl className="data-kv">
                <div>
                  <dt>Start Timestamp</dt>
                  <dd className="code">{event.start_timestamp || "—"}</dd>
                </div>
                <div>
                  <dt>End Timestamp</dt>
                  <dd className="code">{event.end_timestamp || "—"}</dd>
                </div>
              </dl>
            </div>

            {/* SECTION: DEPTH ALIGNMENT */}
            <div>
              <div className="section-label" style={{ marginBottom: "var(--space-xs)" }}>
                DEPTH & ALIGNMENT
              </div>
              <dl className="data-kv">
                <div>
                  <dt>Measured Depth (MD)</dt>
                  <dd>
                    {event.md_start != null
                      ? `${event.md_start.toFixed(0)} ft${
                          event.md_end != null ? ` – ${event.md_end.toFixed(0)} ft` : ""
                        }`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>True Vertical Depth (TVD)</dt>
                  <dd>
                    {event.tvd_start != null
                      ? `${event.tvd_start.toFixed(0)} ft${
                          event.tvd_end != null ? ` – ${event.tvd_end.toFixed(0)} ft` : ""
                        }`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Depth Alignment</dt>
                  <dd>{event.depth_alignment_status || "UNAVAILABLE"}</dd>
                </div>
              </dl>
            </div>

            {/* SECTION: SOURCE EVIDENCE */}
            {event.source && (
              <div>
                <div className="section-label" style={{ marginBottom: "var(--space-xs)" }}>
                  SOURCE RECORD & CITATION
                </div>
                <div
                  style={{
                    background: "var(--color-surface-sunken)",
                    padding: "var(--space-sm)",
                    borderRadius: "var(--radius-md)",
                    fontFamily: "var(--font-code)",
                    fontSize: "var(--text-data-sm)",
                    lineHeight: "1.5",
                  }}
                >
                  {event.source.document_name && (
                    <div>Doc: {event.source.document_name}</div>
                  )}
                  {event.source.section && <div>Section: {event.source.section}</div>}
                  {event.source.original_event_type && (
                    <div>Original Term: {event.source.original_event_type}</div>
                  )}
                  {event.source.source_text && (
                    <div
                      style={{
                        marginTop: 6,
                        fontStyle: "italic",
                        color: "var(--color-body)",
                        borderLeft: "2px solid var(--color-brass)",
                        paddingLeft: 8,
                      }}
                    >
                      "{event.source.source_text}"
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION: PROVENANCE & ORIGIN */}
            <div>
              <div className="section-label" style={{ marginBottom: "var(--space-xs)" }}>
                PROVENANCE & ORIGIN
              </div>
              <dl className="data-kv">
                <div>
                  <dt>Data Origin</dt>
                  <dd>{event.data_origin || "—"}</dd>
                </div>
                <div>
                  <dt>Provenance</dt>
                  <dd>{event.provenance || "—"}</dd>
                </div>
              </dl>
            </div>

            {/* SECTION: LIMITATIONS */}
            {event.limitations && event.limitations.length > 0 && (
              <div>
                <div
                  className="section-label"
                  style={{ color: "var(--color-brass)", marginBottom: "var(--space-xs)" }}
                >
                  LIMITATIONS & UNCERTAINTIES
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "var(--space-md)",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-body)",
                  }}
                >
                  {Array.isArray(event.limitations) ? (
                    event.limitations.map((lim, idx) => <li key={idx}>{lim}</li>)
                  ) : (
                    <li>{event.limitations}</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* DRAWER FOOTER / NAVIGATION */}
          <div
            style={{
              padding: "var(--space-md)",
              borderTop: "1px solid var(--color-hairline)",
              background: "var(--color-surface-sunken)",
              display: "flex",
              gap: "var(--space-xs)",
            }}
          >
            {onNavigateHistorical && (
              <button
                onClick={() => onNavigateHistorical(event)}
                className="button button-signal"
                style={{ flex: 1 }}
              >
                View Historical Evidence →
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
