"""
ml/features/state_features.py

TASK 2B — Observable signal state features.

Produces simple, transparent binary/categorical state indicators.

IMPORTANT NAMING CONVENTION:
  State features use observational language only.
  Example: `rotary_speed_zero` (observable fact)
  NOT: `rig_drilling` or `rig_rotating` (physical interpretation)

Physical-event labels (drilling, tripping, sliding, etc.) cannot be
established from WELL-1 telemetry alone. See M0.2 findings.
"""

from typing import Optional
import math
from .windows import CANONICAL_MEASUREMENT_FIELDS


def _is_null(v) -> bool:
    return v is None or (isinstance(v, float) and math.isnan(v))


def compute_state_features(record: dict) -> dict:
    """
    Compute observable state features for a single canonical record.

    Parameters
    ----------
    record : dict
        A canonical NWIS telemetry record.

    Returns
    -------
    dict of state indicator features.
    """
    measurements = record.get("measurements", {})
    states = {}

    # --- Per-channel presence / zero / missing states ---
    for field in CANONICAL_MEASUREMENT_FIELDS:
        m = measurements.get(field)
        if m is None:
            val = None
            quality = "MISSING"
        else:
            val = m.get("value")
            quality = m.get("quality", "MISSING")

        states[f"{field}_signal_present"] = 0 if _is_null(val) else 1
        states[f"{field}_signal_missing"] = 1 if _is_null(val) else 0
        states[f"{field}_signal_zero"]    = 1 if (val is not None and not _is_null(val) and val == 0.0) else 0
        states[f"{field}_source_gap"]     = 1 if quality == "SOURCE_GAP" else 0

    # --- Rotary speed observable states ---
    # Named descriptively without physical-event labelling
    rpm_m = measurements.get("rotary_speed")
    rpm_val = rpm_m.get("value") if rpm_m else None
    states["rotary_speed_is_zero"]    = 1 if (rpm_val is not None and not _is_null(rpm_val) and rpm_val == 0.0) else 0
    states["rotary_speed_is_nonzero"] = 1 if (rpm_val is not None and not _is_null(rpm_val) and rpm_val != 0.0) else 0
    states["rotary_speed_available"]  = 0 if _is_null(rpm_val) else 1

    # --- Telemetry-level state ---
    ts_status = record.get("telemetry_status", "EMPTY")
    states["telemetry_partial"] = 1 if ts_status == "PARTIAL" else 0
    states["telemetry_gap"]     = 1 if ts_status == "SOURCE_GAP" else 0
    states["telemetry_empty"]   = 1 if ts_status == "EMPTY" else 0

    # --- Block position observable state ---
    bpos_m = measurements.get("block_position")
    bpos_val = bpos_m.get("value") if bpos_m else None
    states["block_position_at_zero"]    = 1 if (bpos_val is not None and not _is_null(bpos_val) and bpos_val == 0.0) else 0
    states["block_position_positive"]   = 1 if (bpos_val is not None and not _is_null(bpos_val) and bpos_val > 0.0) else 0
    states["block_position_available"]  = 0 if _is_null(bpos_val) else 1

    # --- Flow observable state ---
    flow_m = measurements.get("flow_rate")
    flow_val = flow_m.get("value") if flow_m else None
    states["flow_rate_is_zero"]    = 1 if (flow_val is not None and not _is_null(flow_val) and flow_val == 0.0) else 0
    states["flow_rate_is_nonzero"] = 1 if (flow_val is not None and not _is_null(flow_val) and flow_val != 0.0) else 0

    return states
