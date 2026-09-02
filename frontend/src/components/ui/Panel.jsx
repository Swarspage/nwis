/**
 * Panel — Shared content panel primitive.
 *
 * Replaces the identical local Panel component that existed in every page.
 * All pages now import this single shared implementation.
 *
 * Props:
 *   label      — string, optional uppercase section label above content
 *   title      — string, optional larger heading (alternative to label)
 *   headerRight — ReactNode, content for the right side of the header row
 *   children   — ReactNode
 *   style      — optional style overrides for the outer container
 *   dark       — boolean, use dark ink background (for control bars etc.)
 *   noPadding  — boolean, remove internal padding (for edge-to-edge content)
 */
export default function Panel({ label, title, children, headerRight, style, dark, noPadding }) {
  const bg = dark ? "var(--color-ink)" : "var(--color-surface)";
  const borderColor = dark ? "transparent" : "var(--color-hairline)";
  const textColor = dark ? "var(--color-sidebar-ink)" : undefined;

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-lg)",
        padding: noPadding ? 0 : "var(--space-lg)",
        color: textColor,
        ...style,
      }}
    >
      {(label || title || headerRight) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-md)",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
          }}
        >
          <div>
            {label && (
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-label-sm)",
                  fontWeight: "var(--weight-medium)",
                  color: dark ? "rgba(234,240,238,0.5)" : "var(--color-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: title ? 4 : 0,
                }}
              >
                {label}
              </div>
            )}
            {title && (
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-heading-md)",
                  fontWeight: "var(--weight-medium)",
                  color: dark ? "var(--color-sidebar-ink)" : "var(--color-ink)",
                  lineHeight: "var(--leading-heading-md)",
                }}
              >
                {title}
              </div>
            )}
          </div>
          {headerRight && <div style={{ flexShrink: 0 }}>{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
