/**
 * FocusContext — Cross-panel intelligence wiring.
 *
 * A single global focus state that wires all NWIS pages into one
 * intelligence system. Any panel can set a focus; any other panel
 * can respond to it.
 *
 * Focus shape:
 *   { type: 'signal'|'evidence'|'driver'|'well'|'depth'|'timestamp',
 *     key: string,       // feature key, well ID, timestamp ISO, depth value
 *     label: string,     // human-readable label for UI
 *     meta: object }     // additional payload (optional)
 *
 * Usage:
 *   const { focusContext, setFocusContext, isFocused, clearFocus } = useFocusContext();
 *
 * setFocusContext({ type: 'signal', key: 'torque', label: 'Torque' })
 * isFocused('signal', 'torque') // → true
 */
import { useContext, createContext, useCallback, useEffect } from "react";
import { useAppState } from "../../app/AppState.jsx";

export const FOCUS_TYPES = {
  SIGNAL: "signal",         // A telemetry channel/feature key
  EVIDENCE: "evidence",     // An evidence item from M0.5 or M0.6
  DRIVER: "driver",         // A risk driver from M0.8
  WELL: "well",             // A well ID (for historical navigation)
  DEPTH: "depth",           // A depth value
  TIMESTAMP: "timestamp",   // An ISO timestamp (for replay sync)
};

/**
 * useFocusContext — Main hook to read/write the global focus context.
 * Must be used inside AppStateProvider.
 */
export function useFocusContext() {
  const { focusContext, setFocusContext } = useAppState();

  const isFocused = useCallback(
    (type, key) => {
      if (!focusContext) return false;
      return focusContext.type === type && focusContext.key === key;
    },
    [focusContext]
  );

  const isTypeFocused = useCallback(
    (type) => {
      if (!focusContext) return false;
      return focusContext.type === type;
    },
    [focusContext]
  );

  const clearFocus = useCallback(() => {
    setFocusContext(null);
  }, [setFocusContext]);

  const focus = useCallback(
    (type, key, label, meta = {}) => {
      setFocusContext({ type, key, label: label || key, meta });
    },
    [setFocusContext]
  );

  return {
    focusContext,
    setFocusContext,
    isFocused,
    isTypeFocused,
    clearFocus,
    focus,
  };
}

/**
 * useFocusKeyHandler — Registers ESC key to clear focus globally.
 * Call once per page at the top level.
 */
export function useFocusKeyHandler() {
  const { clearFocus, focusContext } = useFocusContext();

  useEffect(() => {
    if (!focusContext) return;
    const handler = (e) => {
      if (e.key === "Escape") clearFocus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusContext, clearFocus]);
}

/**
 * FocusBanner — Small dismissible banner shown when a focus context is active.
 * Renders near the top of any page to indicate "focused view" state.
 */
export function FocusBanner() {
  const { focusContext, clearFocus } = useFocusContext();
  if (!focusContext) return null;

  const typeLabels = {
    signal: "Signal",
    evidence: "Evidence",
    driver: "Risk Driver",
    well: "Well",
    depth: "Depth",
    timestamp: "Timestamp",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        padding: "7px 14px",
        background: "var(--color-signal-teal-soft)",
        border: "1px solid var(--color-signal-teal)",
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--space-md)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label-sm)",
          color: "var(--color-signal-teal)",
          fontWeight: "var(--weight-medium)",
        }}
      >
        {typeLabels[focusContext.type] || "Focus"}:
      </span>
      <span
        style={{
          fontFamily: "var(--font-code)",
          fontSize: "var(--text-data-sm)",
          color: "var(--color-ink)",
        }}
      >
        {focusContext.key === "depth" ? "Depth selected — canonical sensor depth unavailable" : focusContext.label}
      </span>
      <button
        onClick={clearFocus}
        title="Clear focus (Esc)"
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-signal-teal)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-label-sm)",
          padding: "0 4px",
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
