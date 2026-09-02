/**
 * RiskLevelBadge — Risk level pill using NWIS semantic colors.
 *
 * ELEVATED → rust | WATCH → brass | NORMAL → moss | unknown → muted
 *
 * Design rule: moss/brass/rust used only when API provides a risk_level.
 * Never apply risk semantics to raw numerical scores without level context.
 *
 * Props:
 *   level — string from API (e.g. "ELEVATED", "WATCH", "NORMAL")
 */
import { titleize } from "../../utils/format.js";

const RISK_COLORS = {
  ELEVATED: {
    bg: "var(--color-rust-soft)",
    text: "var(--color-rust)",
    border: "var(--color-rust)",
  },
  HIGH: {
    bg: "var(--color-rust-soft)",
    text: "var(--color-rust)",
    border: "var(--color-rust)",
  },
  WATCH: {
    bg: "var(--color-brass-soft)",
    text: "var(--color-brass)",
    border: "var(--color-brass)",
  },
  MEDIUM: {
    bg: "var(--color-brass-soft)",
    text: "var(--color-brass)",
    border: "var(--color-brass)",
  },
  NORMAL: {
    bg: "var(--color-moss-soft)",
    text: "var(--color-moss)",
    border: "var(--color-moss)",
  },
  LOW: {
    bg: "var(--color-moss-soft)",
    text: "var(--color-moss)",
    border: "var(--color-moss)",
  },
};

export default function RiskLevelBadge({ level }) {
  const upper = (level || "").toUpperCase();
  const c = RISK_COLORS[upper] || {
    bg: "var(--color-canvas)",
    text: "var(--color-mute)",
    border: "var(--color-hairline)",
  };

  return (
    <span
      style={{
        display: "inline-block",
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-label-sm)",
        fontWeight: "var(--weight-medium)",
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      {titleize(level) || "—"}
    </span>
  );
}
