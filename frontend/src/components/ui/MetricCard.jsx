/**
 * MetricCard — Rich engineering metric card with quality badge and trend.
 *
 * Used in Telemetry metric matrix and anywhere a single instrument value
 * needs to be displayed with full context.
 *
 * Props:
 *   label       — string, parameter name
 *   value       — number | null
 *   unit        — string, e.g. "psi", "gpm", "ft"
 *   quality     — "available" | "missing" | "unavailable"
 *   trend       — "up" | "down" | "stable" | null
 *   anomaly     — boolean, flags this metric as anomalous
 *   focused     — boolean, highlights this card (focus context)
 *   onClick     — function, handler for focus activation
 *   small       — boolean, compact variant
 */
import DataQualityBadge from "./DataQualityBadge.jsx";

function TrendArrow({ trend }) {
  if (!trend || trend === "stable") return null;
  const up = trend === "up";
  return (
    <span
      style={{
        fontFamily: "var(--font-code)",
        fontSize: 12,
        color: up ? "var(--color-brass)" : "var(--color-signal-teal)",
        fontWeight: "var(--weight-semibold)",
        lineHeight: 1,
      }}
    >
      {up ? "↑" : "↓"}
    </span>
  );
}

export default function MetricCard({
  label,
  value,
  unit,
  quality = "available",
  trend,
  anomaly = false,
  focused = false,
  onClick,
  small = false,
}) {
  const hasValue = value !== null && value !== undefined;
  const displayValue = hasValue
    ? typeof value === "number"
      ? value >= 1000
        ? `${(value / 1000).toFixed(2)}k`
        : value.toFixed(value % 1 === 0 ? 0 : 2)
      : String(value)
    : null;

  const borderColor = anomaly
    ? "var(--color-brass)"
    : focused
    ? "var(--color-signal-teal)"
    : "var(--color-hairline)";

  const bg = focused
    ? "var(--color-signal-teal-soft)"
    : anomaly
    ? "var(--color-brass-soft)"
    : "var(--color-surface)";

  return (
    <div
      onClick={onClick}
      className={onClick ? "card-interactive" : ""}
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-lg)",
        padding: small ? "12px 14px" : "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      {/* Label */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label-sm)",
          fontWeight: "var(--weight-medium)",
          color: anomaly ? "var(--color-brass)" : "var(--color-body)",
          letterSpacing: "var(--tracking-label-sm)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {label}
        {anomaly && (
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--color-brass)",
              animation: "livePulse 1.8s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* Value + trend */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        {hasValue ? (
          <>
            <span
              style={{
                fontFamily: "var(--font-code)",
                fontSize: small ? "var(--text-data-md)" : "var(--text-data-lg)",
                fontWeight: "var(--weight-medium)",
                color: "var(--color-ink)",
                lineHeight: 1.2,
                letterSpacing: "var(--tracking-data-lg)",
              }}
            >
              {displayValue}
            </span>
            {unit && (
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-label-sm)",
                  color: "var(--color-mute)",
                }}
              >
                {unit}
              </span>
            )}
            <TrendArrow trend={trend} />
          </>
        ) : (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-mute)",
              fontStyle: "italic",
            }}
          >
            Unavailable
          </span>
        )}
      </div>

      {/* Quality badge */}
      <DataQualityBadge status={hasValue ? quality : "unavailable"} />
    </div>
  );
}
