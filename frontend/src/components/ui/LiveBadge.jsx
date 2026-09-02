/**
 * LiveBadge — Animated teal live/streaming indicator badge.
 *
 * Replaces the repeated inline live pulse pattern across every page.
 *
 * Props:
 *   label   — string (default: "Live")
 *   size    — "sm" | "md" (default: "sm")
 *   onDark  — boolean, render with transparent background (for dark surfaces)
 */
export default function LiveBadge({ label = "Live", size = "sm", onDark = false }) {
  const fontSize = size === "md" ? "var(--text-body-sm)" : "var(--text-label-sm)";
  const bg = onDark ? "rgba(30,138,138,0.18)" : "var(--color-signal-teal-soft)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: bg,
        color: "var(--color-signal-teal)",
        fontFamily: "var(--font-body)",
        fontSize,
        fontWeight: "var(--weight-medium)",
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--color-signal-teal)",
          animation: "livePulse 1.8s ease-in-out infinite",
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  );
}
