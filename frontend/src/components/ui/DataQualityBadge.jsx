/**
 * DataQualityBadge — Data status and provenance indicator badge.
 *
 * Used throughout NWIS to distinguish:
 *   available       — data present from API
 *   missing         — channel exists but value is null/missing
 *   unavailable     — channel not in this dataset
 *   synthetic       — SYNTHETIC DEMO / simulated data
 *   historical      — HISTORICAL REPLAY
 *   confirmed       — event status: verified by evidence
 *   unverified      — event status: not independently confirmed
 *   not_validated   — model status: not real-world validated
 *
 * Props:
 *   status — one of the STATUS keys below
 *   label  — optional override label
 */

const STATUS_CONFIG = {
  available: {
    bg: "var(--color-moss-soft)",
    text: "var(--color-moss)",
    border: "var(--color-moss)",
    dot: true,
    label: "Available",
  },
  missing: {
    bg: "var(--color-brass-soft)",
    text: "var(--color-brass)",
    border: "var(--color-brass)",
    dot: true,
    label: "Missing",
  },
  unavailable: {
    bg: "var(--color-canvas)",
    text: "var(--color-mute)",
    border: "var(--color-hairline-strong)",
    dot: false,
    label: "Unavailable",
  },
  synthetic: {
    bg: "var(--color-brass-soft)",
    text: "var(--color-brass)",
    border: "var(--color-brass)",
    dot: false,
    label: "Synthetic Demo",
  },
  historical: {
    bg: "var(--color-signal-teal-soft)",
    text: "var(--color-signal-teal)",
    border: "var(--color-signal-teal)",
    dot: false,
    label: "Historical Replay",
  },
  confirmed: {
    bg: "var(--color-moss-soft)",
    text: "var(--color-moss)",
    border: "var(--color-moss)",
    dot: false,
    label: "Confirmed",
  },
  unverified: {
    bg: "var(--color-brass-soft)",
    text: "var(--color-brass)",
    border: "var(--color-brass)",
    dot: false,
    label: "Unverified",
  },
  not_validated: {
    bg: "var(--color-rust-soft)",
    text: "var(--color-rust)",
    border: "var(--color-rust)",
    dot: false,
    label: "Not Real-World Validated",
  },
  prototype: {
    bg: "var(--color-rust-soft)",
    text: "var(--color-rust)",
    border: "var(--color-rust)",
    dot: false,
    label: "Prototype Only",
  },
};

export default function DataQualityBadge({ status, label }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unavailable;
  const displayLabel = label || config.label;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-label-sm)",
        fontWeight: "var(--weight-medium)",
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {config.dot && (
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: config.text,
            flexShrink: 0,
          }}
        />
      )}
      {displayLabel}
    </span>
  );
}
