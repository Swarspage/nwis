"""
ml/intelligence/anomaly_detector.py

Per-feature anomaly component scores and combined anomaly score.

DESIGN DECISIONS (corrections from review):

1. time_delta_seconds is NOT in the weighted anomaly score.
   It is handled exclusively in the quality gate (intelligence_engine.py).
   Timing irregularities are a telemetry quality issue, not a physical signal anomaly.

2. Rolling baseline: z_scores() is ALWAYS called before push() for each record.
   The current observation never informs its own baseline.

3. Rolling correlation (roll_medium_sppa_hkld_corr) is a GUARDED feature:
   - Requires roll_medium_n_obs >= CORR_MIN_OBS in both involved channels
   - Requires the range of both signals in the window > CORR_MIN_RANGE
   - If either guard fails, correlation is excluded from the score (weight redistributed)

4. Language: feature names map to generic anomaly descriptions.
   No event-specific labels (kick, stuck pipe, washout, etc.) are used.

WEIGHTS:
  Weights are prototype parameters. They sum to 1.0 across the 7 scoreable features.
  When a feature is missing or guarded-off, its weight is excluded and the remaining
  weights are renormalized so the score remains in [0, 100].

SCORE FORMULA:
  component_score(feature) = clip(|z_score| / Z_NORM, 0, 1)
  anomaly_score = 100 * sum(weight_i * component_i) / sum(active_weights)
"""

import math
from typing import Optional

# Normalisation: a z-score of Z_NORM corresponds to component_score = 1.0
Z_NORM = 3.0

# Guards for correlation feature
CORR_MIN_OBS    = 10     # minimum n_obs in medium window before correlation is used
CORR_MIN_RANGE  = 1.0    # minimum signal range (max-min) in window for both signals

# Prototype weights — MUST sum to 1.0
FEATURE_WEIGHTS: dict[str, float] = {
    "hookload_mean":        0.22,
    "hookload_change":      0.13,
    "sppa_std":             0.22,
    "sppa_change":          0.11,
    "bpos_delta":           0.14,
    "hkld_bpos_diff":       0.12,
    "sppa_hkld_corr":       0.06,
}
assert abs(sum(FEATURE_WEIGHTS.values()) - 1.0) < 1e-9, "Weights must sum to 1.0"

_WEIGHT_NOTE = (
    "All weights are prototype parameters for the NWIS MVP. "
    "They have not been calibrated against confirmed drilling events."
)


def _safe(v) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _component(z: Optional[float]) -> Optional[float]:
    """Clip |z| / Z_NORM to [0, 1]. None if z is None."""
    if z is None:
        return None
    return min(abs(z) / Z_NORM, 1.0)


def _extract_mvp_values(feature_record: dict) -> dict:
    """
    Extract the 7 MVP feature values from a feature record into a flat dict.
    Returns None for missing or invalid values.
    Does NOT extract time_delta_seconds (quality gate only).
    """
    sig  = feature_record.get("signal_features", {})
    rel  = feature_record.get("relationship_features", {})

    hkld  = sig.get("hookload", {})
    sppa  = sig.get("standpipe_pressure", {})
    bpos  = sig.get("block_position", {})

    return {
        "hookload_mean":   _safe(hkld.get("roll_medium_mean")),
        "hookload_change":  _safe(hkld.get("meaningful_change")),
        "sppa_std":        _safe(sppa.get("roll_short_std")),
        "sppa_change":     _safe(sppa.get("meaningful_change")),
        "bpos_delta":      _safe(bpos.get("delta")),
        "hkld_bpos_diff":  _safe(rel.get("hookload_bpos_diff")),
        "sppa_hkld_corr":  _safe(rel.get("roll_medium_sppa_hkld_corr")),
    }


def _correlation_guard_passed(feature_record: dict) -> bool:
    """
    Check whether the rolling correlation feature has sufficient observation
    count and signal variance to be trustworthy.

    Guards:
    - roll_medium_n_obs for hookload >= CORR_MIN_OBS
    - roll_medium_n_obs for standpipe_pressure >= CORR_MIN_OBS
    - range(hookload in medium window) > CORR_MIN_RANGE
    - range(standpipe_pressure in medium window) > CORR_MIN_RANGE
    """
    sig = feature_record.get("signal_features", {})
    hkld = sig.get("hookload", {})
    sppa = sig.get("standpipe_pressure", {})

    hkld_n   = hkld.get("roll_medium_n_obs") or 0
    sppa_n   = sppa.get("roll_medium_n_obs") or 0
    hkld_min = _safe(hkld.get("roll_medium_min"))
    hkld_max = _safe(hkld.get("roll_medium_max"))
    sppa_min = _safe(sppa.get("roll_medium_min"))
    sppa_max = _safe(sppa.get("roll_medium_max"))

    if hkld_n < CORR_MIN_OBS or sppa_n < CORR_MIN_OBS:
        return False
    if hkld_min is None or hkld_max is None or (hkld_max - hkld_min) < CORR_MIN_RANGE:
        return False
    if sppa_min is None or sppa_max is None or (sppa_max - sppa_min) < CORR_MIN_RANGE:
        return False
    return True


def compute_component_scores(
    z_scores: dict,
    feature_record: dict,
) -> dict:
    """
    Convert z-scores into clipped [0,1] component anomaly scores.

    Applies the correlation guard: if the guard fails, sppa_hkld_corr is
    set to None regardless of its z-score.

    Parameters
    ----------
    z_scores : dict — output of RollingBaseline.z_scores()
    feature_record : dict — the full feature record (for guard checks)

    Returns
    -------
    dict — component_key → float or None
    """
    components = {}
    for key in FEATURE_WEIGHTS:
        z = z_scores.get(key)
        # Correlation guard
        if key == "sppa_hkld_corr" and not _correlation_guard_passed(feature_record):
            components[key] = None
        else:
            components[key] = _component(z)
    return components


def combine_scores(components: dict) -> tuple[float, float, int]:
    """
    Combine component scores into a single anomaly score [0, 100].

    Missing components have their weights redistributed proportionally
    among the available components. This ensures the score always uses
    the full [0, 100] range even when features are unavailable.

    Parameters
    ----------
    components : dict — feature_key → float or None

    Returns
    -------
    (anomaly_score, effective_weight_used, available_feature_count)
    """
    active = {k: v for k, v in components.items() if v is not None}
    if not active:
        return 0.0, 0.0, 0

    total_weight = sum(FEATURE_WEIGHTS[k] for k in active)
    if total_weight < 1e-9:
        return 0.0, 0.0, 0

    weighted_sum = sum(FEATURE_WEIGHTS[k] * active[k] for k in active)
    # Normalize by total_weight of active features so missing features don't
    # suppress the score — the scale remains [0, 100]
    score = 100.0 * weighted_sum / total_weight

    return min(score, 100.0), total_weight, len(active)
