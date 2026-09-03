/**
 * LoadingState — Pulsating Global Skeleton System
 * NWIS Operational Telemetry & Risk Intelligence Platform
 */
import "./LoadingState.css";

export function PulsatingText({ children, style = {}, className = "" }) {
  return (
    <span className={`skeleton-pulsating-text ${className}`} style={style}>
      {children}
    </span>
  );
}

export function SkeletonBlock({ width = "100%", height = "16px", borderRadius, style = {}, className = "" }) {
  return (
    <div
      className={`skeleton-block ${className}`}
      style={{
        width,
        height,
        borderRadius: borderRadius ? borderRadius : undefined,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ height, children, className = "", style = {} }) {
  return (
    <div className={`skeleton-card ${className}`} style={{ height, ...style }}>
      {children || (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SkeletonBlock width="45%" height="14px" />
            <PulsatingText>[ STREAM ]</PulsatingText>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
            <SkeletonBlock width="60%" height="28px" />
            <PulsatingText style={{ fontSize: "12px" }}>--.-</PulsatingText>
          </div>
          <SkeletonBlock width="85%" height="12px" />
          <div style={{ height: "4px", width: "100%", background: "rgba(30, 138, 138, 0.15)", borderRadius: "4px", overflow: "hidden", marginTop: "4px" }}>
            <div style={{ height: "100%", width: "45%", background: "var(--color-signal-teal, #1E8A8A)", borderRadius: "4px", animation: "skeleton-shimmer-pulse 1.4s ease-in-out infinite" }} />
          </div>
        </>
      )}
    </div>
  );
}

export function PageHeaderSkeleton({ titleWidth = "240px", subtitleWidth = "420px", label = "NWIS INTELLIGENCE" }) {
  return (
    <div className="skeleton-header">
      <PulsatingText>{label}</PulsatingText>
      <div className="skeleton-header-meta" style={{ marginTop: "4px" }}>
        <SkeletonBlock width={titleWidth} height="34px" />
        <SkeletonBlock width="85px" height="24px" borderRadius="999px" />
      </div>
      <SkeletonBlock width={subtitleWidth} height="14px" style={{ marginTop: "6px" }} />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="skeleton-table-wrapper">
      <div className="skeleton-table-header">
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonBlock key={c} width={`${Math.max(70, 100 - c * 15)}px`} height="14px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skeleton-table-row" key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} style={{ width: c === 0 ? "35%" : c === cols - 1 ? "15%" : "20%", display: "flex", alignItems: "center", gap: "8px" }}>
              {c === 0 && <span className="skeleton-status-dot" style={{ width: "6px", height: "6px" }} />}
              <SkeletonBlock width="100%" height="16px" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function GaugeHeroSkeleton() {
  return (
    <div className="skeleton-hero-panel">
      <div className="skeleton-gauge-circle">
        <PulsatingText style={{ fontSize: "12px", color: "var(--color-signal-teal, #1E8A8A)" }}>M0.8 RISK</PulsatingText>
        <PulsatingText style={{ fontSize: "20px", fontWeight: "bold", marginTop: "4px" }}>--.-</PulsatingText>
        <PulsatingText style={{ fontSize: "9px", marginTop: "2px" }}>ANALYZING</PulsatingText>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "14px" }}>
        <PulsatingText>[ FUSING M0.5 & M0.6 DATA ]</PulsatingText>
        <SkeletonBlock width="160px" height="38px" />
        <SkeletonBlock width="95%" height="14px" />
        <SkeletonBlock width="75%" height="14px" />
        <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
          <SkeletonBlock width="110px" height="30px" borderRadius="8px" />
          <SkeletonBlock width="130px" height="30px" borderRadius="8px" />
        </div>
      </div>
    </div>
  );
}

export default function LoadingState({ variant = "default", lines = 4, statusMessage }) {
  const defaultStatus =
    variant === "risk"
      ? "COMPUTING M0.8 FUSION RISK INTELLIGENCE..."
      : variant === "telemetry"
      ? "STREAMING M0.4 HIGH-FREQUENCY TELEMETRY..."
      : variant === "features"
      ? "DERIVING M0.4 FEATURE CHANNELS..."
      : variant === "models"
      ? "EVALUATING M0.6 STATISTICAL ENSEMBLE..."
      : variant === "intelligence"
      ? "QUERYING M0.5 DETERMINISTIC RULES..."
      : variant === "guidance"
      ? "GENERATING EVIDENCE-GROUNDED GUIDANCE..."
      : "SYNCHRONIZING REAL-TIME TELEMETRY STREAM...";

  const activeMessage = statusMessage || defaultStatus;

  return (
    <div className="skeleton-container" aria-label="Loading content">
      {/* Top Pulsating Telemetry Status Bar */}
      <div className="skeleton-status-bar">
        <div className="skeleton-status-label">
          <span className="skeleton-status-dot" />
          {activeMessage}
        </div>
        <PulsatingText style={{ fontSize: "10px" }}>[ CONNECTED ]</PulsatingText>
      </div>

      {variant === "overview" && (
        <>
          <PageHeaderSkeleton titleWidth="280px" subtitleWidth="440px" label="NWIS OVERVIEW · LIVE TELEMETRY" />
          <div className="skeleton-grid-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="skeleton-grid-2">
            <SkeletonCard height="240px" />
            <SkeletonCard height="240px" />
          </div>
        </>
      )}

      {variant === "risk" && (
        <>
          <PageHeaderSkeleton titleWidth="300px" subtitleWidth="380px" label="M0.8 RISK FUSION CENTER" />
          <GaugeHeroSkeleton />
          <div className="skeleton-grid-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </>
      )}

      {(variant === "table" || variant === "telemetry" || variant === "features") && (
        <>
          <PageHeaderSkeleton titleWidth="250px" subtitleWidth="480px" label="TELEMETRY & DATA QUALITY" />
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <PulsatingText style={{ marginRight: "4px" }}>CHANNELS:</PulsatingText>
            <SkeletonBlock width="110px" height="28px" borderRadius="999px" />
            <SkeletonBlock width="110px" height="28px" borderRadius="999px" />
            <SkeletonBlock width="110px" height="28px" borderRadius="999px" />
          </div>
          <TableSkeleton rows={Math.max(4, lines)} cols={5} />
        </>
      )}

      {(variant === "models" || variant === "intelligence" || variant === "guidance") && (
        <>
          <PageHeaderSkeleton titleWidth="320px" subtitleWidth="420px" label="MODEL ENSEMBLE & INTELLIGENCE" />
          <div className="skeleton-grid-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <TableSkeleton rows={4} cols={4} />
        </>
      )}

      {variant === "default" && (
        <>
          <PageHeaderSkeleton />
          <div className="skeleton-card">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <PulsatingText>[ PROCESSING RECORD STACK ]</PulsatingText>
              <PulsatingText style={{ fontSize: "10px" }}>LIVE</PulsatingText>
            </div>
            {Array.from({ length: lines }).map((_, index) => (
              <SkeletonBlock
                key={index}
                width={`${95 - index * 14}%`}
                height={index === 0 ? "24px" : "14px"}
                style={{ marginBottom: index === 0 ? "8px" : "4px" }}
              />
            ))}
          </div>
          <div className="skeleton-grid-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </>
      )}
    </div>
  );
}
