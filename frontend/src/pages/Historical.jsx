/**
 * Historical — Historical Knowledge & Offset Context.
 *
 * Purpose: What does NWIS know about this well's history and comparable wells?
 *
 * Visual hierarchy:
 *   1. Well Context Card — well identity, provenance, data source
 *   2. Historical Event Records — verified events (or honest empty state)
 *   3. Offset Well Context — relevant wells from API (no implied similarity score)
 *   4. Forecasting Readiness — what NWIS can establish TODAY vs. what more data unlocks
 *
 * Rules:
 *   - NEVER imply offset well similarity scores exist (they don't)
 *   - NEVER imply confirmed events when API returns empty
 *   - Forecasting Readiness section is PROMINENT and DELIBERATE — not disabled/greyed
 *   - WELL-1 provenance: "Historical · VLOVE Dataset"
 *   - WELL-2..6 provenance: "Synthetic Demo"
 *
 * Cross-panel: clicking a relevant well sets focusContext.well
 */
import { motion } from "framer-motion";
import { useAppState } from "../app/AppState.jsx";
import { useFocusContext, useFocusKeyHandler, FocusBanner, FOCUS_TYPES } from "../components/ui/FocusContext.jsx";
import { useApiResource } from "../api/hooks.js";
import { api } from "../api/client.js";
import Panel from "../components/ui/Panel.jsx";

import DataTable from "../components/ui/DataTable.jsx";
import DataQualityBadge from "../components/ui/DataQualityBadge.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { formatTimestamp, titleize } from "../utils/format.js";

const WELL_PROVENANCE = {
  "WELL-1": { label: "Historical · VLOVE Dataset", status: "historical", note: "Derived from historical drilling records. Events are unverified historical observations, not confirmed engineering decisions." },
  "WELL-2": { label: "Synthetic Demo", status: "synthetic", note: "Synthetic simulation dataset. No real historical events." },
  "WELL-3": { label: "Synthetic Demo", status: "synthetic", note: "Synthetic simulation dataset. No real historical events." },
  "WELL-4": { label: "Synthetic Demo", status: "synthetic", note: "Synthetic simulation dataset. No real historical events." },
  "WELL-5": { label: "Synthetic Demo", status: "synthetic", note: "Synthetic simulation dataset. No real historical events." },
  "WELL-6": { label: "Synthetic Demo", status: "synthetic", note: "Synthetic simulation dataset. No real historical events." },
};

// Forecasting Readiness items — what NWIS can do TODAY
const READINESS_ITEMS = [
  {
    capability: "Anomaly Detection",
    status: "available",
    description: "M0.5 + M0.6 models detect statistical deviations in real-time operational parameters.",
  },
  {
    capability: "Risk Score Fusion",
    status: "available",
    description: "M0.8 fuses deterministic and statistical evidence into a calibrated risk score (0–100).",
  },
  {
    capability: "Historical Event Lookup",
    status: "available",
    description: "Known historical events from the dataset are available when the API reports them. Currently no confirmed events for this well.",
  },
  {
    capability: "Offset Well Catalogue",
    status: "available",
    description: "Relevant wells are identified by the backend (historical-context endpoint). Catalogue shown below.",
  },
  {
    capability: "Offset Well Similarity Scoring",
    status: "unavailable",
    description: "Quantitative similarity scoring between wells is not yet implemented in the backend. Showing catalogue without similarity metrics.",
  },
  {
    capability: "Predictive Risk Forecasting",
    status: "unavailable",
    description: "Requires validated historical event corpus + confirmed drilling outcomes. Would unlock: next-well risk exposure estimates, pre-drill hazard profiles, lithology-conditional deviation forecasts.",
  },
  {
    capability: "Automated Drilling Advisories",
    status: "unavailable",
    description: "Not in scope for NWIS prototype. NWIS is a decision-support intelligence system, not an autonomous control system. Advisory generation requires engineering validation pipeline.",
  },
];

function ReadinessItem({ item }) {
  const isAvailable = item.status === "available";
  return (
    <div
      style={{
        background: isAvailable ? "var(--color-surface-sunken)" : "var(--color-canvas)",
        border: `1px solid ${isAvailable ? "var(--color-hairline)" : "var(--color-hairline-strong)"}`,
        borderLeft: `3px solid ${isAvailable ? "var(--color-signal-teal)" : "var(--color-hairline-strong)"}`,
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        opacity: isAvailable ? 1 : 0.75,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)" }}>
          {item.capability}
        </span>
        <DataQualityBadge
          status={isAvailable ? "available" : "unavailable"}
          label={isAvailable ? "Available" : "Not Yet Available"}
        />
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-body)", margin: 0, lineHeight: 1.45 }}>
        {item.description}
      </p>
    </div>
  );
}

function OffsetWellCard({ well, focused, onClick }) {
  const wellId = well?.well_id || well?.id || "—";
  const relevance = well?.relevance || well?.relevance_note || well?.note || null;
  const events = well?.event_count ?? well?.events ?? null;

  return (
    <div
      onClick={onClick}
      style={{
        background: focused ? "var(--color-signal-teal-soft)" : "var(--color-surface-sunken)",
        border: `1px solid ${focused ? "var(--color-signal-teal)" : "var(--color-hairline)"}`,
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color var(--motion-fast), background var(--motion-fast), box-shadow var(--motion-base)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.boxShadow = "var(--shadow-card-hover)"; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.boxShadow = "none"; } : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-md)", fontWeight: "var(--weight-medium)", color: "var(--color-ink)" }}>
          {wellId}
        </span>
        {events != null && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-mute)" }}>
            {events} event{events !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {relevance && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-body)", margin: 0, lineHeight: 1.4 }}>
          {relevance}
        </p>
      )}
      <p style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-mute)", margin: 0, fontStyle: "italic" }}>
        No similarity score available — offset well similarity scoring not yet implemented.
      </p>
    </div>
  );
}

export default function Historical() {
  const { selectedWell } = useAppState();
  const { focus, isFocused, clearFocus } = useFocusContext();
  useFocusKeyHandler();

  const provenance = WELL_PROVENANCE[selectedWell] || WELL_PROVENANCE["WELL-1"];

  const historical = useApiResource(
    () => api.historicalEvents(selectedWell),
    [selectedWell]
  );
  const context = useApiResource(
    () => api.historicalContext(null, selectedWell),
    [selectedWell]
  );

  if (historical.state === "loading") return <LoadingState variant="table" lines={6} />;
  if (historical.state === "error") return <ErrorState error={historical.error} />;

  const events = historical.data?.events || [];
  const relevantWells = context.data?.relevant_wells || context.data?.comparable_wells || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="page"
      style={{ gap: "14px" }}
    >

      {/* Page header */}
      <div style={{ marginBottom: "var(--space-sm)" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          M0.7 Historical Knowledge · {selectedWell}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap", marginTop: 4 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display-xl)", fontWeight: "var(--weight-semibold)", color: "var(--color-ink)", margin: 0, letterSpacing: "var(--tracking-display-xl)" }}>
            Historical Knowledge
          </h1>
          <DataQualityBadge status={provenance.status} label={provenance.label} />
        </div>
      </div>

      <FocusBanner />

      {/* Well Context Card */}
      <Panel title="Well Context & Provenance">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <div style={{ display: "flex", gap: "var(--space-xl)", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", marginBottom: 2 }}>Well ID</div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-md)", color: "var(--color-ink)", fontWeight: "var(--weight-medium)" }}>{selectedWell}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", marginBottom: 2 }}>Data Source</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-ink)" }}>{provenance.label}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", marginBottom: 2 }}>Verified Events</div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-md)", color: "var(--color-ink)", fontWeight: "var(--weight-medium)" }}>{events.length}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-label-sm)", color: "var(--color-mute)", marginBottom: 2 }}>Offset Wells</div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-data-md)", color: "var(--color-ink)", fontWeight: "var(--weight-medium)" }}>{relevantWells.length}</div>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", margin: 0, lineHeight: "var(--leading-body-sm)", maxWidth: 640 }}>
            {provenance.note}
          </p>
        </div>
      </Panel>

      {/* Historical Event Records */}
      <Panel
        label="Historical Event Records"
        headerRight={
          <DataQualityBadge
            status={events.length > 0 ? "confirmed" : "unavailable"}
            label={events.length > 0 ? `${events.length} Records` : "No Confirmed Events"}
          />
        }
      >
        {events.length > 0 ? (
          <DataTable
            rows={events}
            columns={[
              { key: "event_id", header: "Event ID" },
              { key: "event_type", header: "Type", render: (row) => titleize(row.event_type) },
              { key: "verification_status", header: "Verification" },
              { key: "timestamp", header: "Timestamp", render: (row) => formatTimestamp(row.timestamp) },
            ]}
            empty="No verified historical event records returned by the API."
          />
        ) : (
          <div style={{ padding: "var(--space-xl)", textAlign: "center", borderRadius: "var(--radius-md)", border: "1px dashed var(--color-hairline-strong)", background: "var(--color-canvas)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-heading-md)", color: "var(--color-mute)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-xs)" }}>
              No confirmed historical events
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)", margin: "0 auto", maxWidth: 420, lineHeight: "var(--leading-body-sm)" }}>
              The API returned zero verified historical event records for {selectedWell}.
              Telemetry anomalies detected by M0.5/M0.6 are statistical observations,
              not confirmed engineering events. Historical events require independent verification.
            </p>
          </div>
        )}
      </Panel>

      {/* Offset Well Context */}
      <Panel
        label="Offset Well Context"
        title="Nearby Well Catalogue"
        headerRight={
          <DataQualityBadge status="unavailable" label="Similarity Scoring Unavailable" />
        }
      >
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-body)", margin: "0 0 var(--space-md)", lineHeight: "var(--leading-body-sm)" }}>
          Offset well similarity scoring is not yet implemented in the backend.
          The wells below are identified by the historical-context API as potentially relevant.
          No quantitative similarity metric is available.
        </p>
        {context.state === "loading" ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)" }}>Loading offset well data…</p>
        ) : relevantWells.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-sm)" }}>
            {relevantWells.map((well, i) => {
              const wellId = well?.well_id || well?.id || `well-${i}`;
              const focused = isFocused(FOCUS_TYPES.WELL, wellId);
              return (
                <OffsetWellCard
                  key={i}
                  well={well}
                  focused={focused}
                  onClick={() => focused ? clearFocus() : focus(FOCUS_TYPES.WELL, wellId, wellId)}
                />
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "var(--space-xl)", textAlign: "center", borderRadius: "var(--radius-md)", border: "1px dashed var(--color-hairline-strong)", background: "var(--color-canvas)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-heading-md)", color: "var(--color-mute)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-xs)" }}>
              No offset well context available
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-mute)", margin: "0 auto", maxWidth: 400, lineHeight: "var(--leading-body-sm)" }}>
              The historical-context API returned no relevant wells for this well ID.
              This is expected for synthetic simulation wells.
            </p>
          </div>
        )}
      </Panel>

      {/* Forecasting Readiness — deliberately prominent */}
      <Panel title="Forecasting Readiness">
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-md)", color: "var(--color-body)", margin: "0 0 var(--space-lg)", lineHeight: "var(--leading-body-md)", maxWidth: 680 }}>
          NWIS can currently establish risk observations from live telemetry and historical patterns.
          The table below documents each forecasting capability: what is available today and what additional
          historical data or engineering work would unlock.
        </p>

        {/* Visual flow diagram */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            flexWrap: "wrap",
            marginBottom: "var(--space-lg)",
            padding: "var(--space-md)",
            background: "var(--color-canvas)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          {[
            { label: "Offset Data", note: "Catalogue only", status: "available" },
            { label: "→", note: null },
            { label: "Historical Events", note: events.length > 0 ? `${events.length} records` : "0 confirmed", status: events.length > 0 ? "available" : "missing" },
            { label: "→", note: null },
            { label: "Behavioural Patterns", note: "M0.5 + M0.6", status: "available" },
            { label: "→", note: null },
            { label: "Risk Exposure Forecast", note: "More data needed", status: "unavailable" },
          ].map((step, i) => (
            step.note === null ? (
              <span key={i} style={{ color: "var(--color-signal-teal)", fontFamily: "var(--font-code)", fontSize: 18, fontWeight: "bold", flexShrink: 0 }}>→</span>
            ) : (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 90 }}>
                <DataQualityBadge status={step.status} label={step.label} />
                <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-mute)", textAlign: "center" }}>{step.note}</span>
              </div>
            )
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-sm)" }}>
          {READINESS_ITEMS.map((item) => (
            <ReadinessItem key={item.capability} item={item} />
          ))}
        </div>
      </Panel>
    </motion.div>
  );
}

