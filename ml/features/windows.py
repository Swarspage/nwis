"""
ml/features/windows.py

Time-window definitions and rolling-window utilities for the NWIS feature engine.

All windows are defined in seconds, not row counts, because:
- WELL-1 has variable sampling intervals (median ~4.9s)
- A ~29,493-second gap exists in WELL-1; row-count windows would bridge it silently

DOCUMENTED CONSTANTS — changing these changes feature semantics. Bump feature_version.
"""

# Window durations in seconds
SHORT_WINDOW_SEC  = 60      # ~12 rows at median 4.9s interval
MEDIUM_WINDOW_SEC = 300     # ~61 rows
LONG_WINDOW_SEC   = 1800    # ~367 rows

# A time delta > this threshold between adjacent records is flagged as abnormal.
# Rationale: 5× the dataset's p99 inter-sample interval (~60s).
# This is a heuristic, not a physical definition.
GAP_THRESHOLD_SEC = 300

WINDOW_LABELS = {
    "short":  SHORT_WINDOW_SEC,
    "medium": MEDIUM_WINDOW_SEC,
    "long":   LONG_WINDOW_SEC,
}

FEATURE_VERSION = "0.1.0"

# Channels that are measured (values may vary) vs. channels flagged constant in WELL-1
# This is dataset-specific metadata; a future source may provide dynamic ROP/WOB.
CONSTANT_IN_WELL1 = {"rate_of_penetration", "weight_on_bit"}

# Canonical fields that map to numeric measurements
CANONICAL_MEASUREMENT_FIELDS = [
    "rate_of_penetration",
    "weight_on_bit",
    "rotary_speed",
    "torque",
    "standpipe_pressure",
    "flow_rate",
    "hookload",
    "block_position",
    # depth is intentionally excluded — no verified continuous depth in WELL-1
]

DEPTH_UNAVAILABLE_REASON = (
    "Canonical depth is null for WELL-1. No verified continuously varying depth channel "
    "exists in this dataset window. Depth-derived features are not computed."
)
