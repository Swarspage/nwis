"""
ml/intelligence/evidence.py

Evidence extraction: identifies top contributing features from component scores.

Every non-NORMAL intelligence result contains machine-readable evidence so the
API/dashboard can answer: "Why did NWIS flag this?"

LANGUAGE POLICY:
    Evidence describes signal behaviour, not physical events.
    "standpipe_pressure.roll_short_std is HIGH" = the signal is unusually volatile.
    This is NOT a claim of a kick, washout, or any other confirmed event.

Evidence direction:
    HIGH     — value is above the rolling baseline (positive z-score)
    LOW      — value is below the rolling baseline (negative z-score)
    ABNORMAL — direction is unclear (e.g. change indicator, binary feature)
"""

from typing import Optional
import math

# Human-readable feature display names (for evidence output only)
FEATURE_DISPLAY_NAMES = {
    "hookload_mean":    "hookload.roll_medium_mean",
    "hookload_change":  "hookload.meaningful_change",
    "sppa_std":         "standpipe_pressure.roll_short_std",
    "sppa_change":      "standpipe_pressure.meaningful_change",
    "bpos_delta":       "block_position.delta",
    "hkld_bpos_diff":   "hookload_bpos_diff",
    "sppa_hkld_corr":   "roll_medium_sppa_hkld_corr",
}

# Features where direction is always ABNORMAL (change indicators or binary flags)
DIRECTION_ABNORMAL_FEATURES = {"hookload_change", "sppa_change", "bpos_delta"}


def _direction(key: str, z: Optional[float]) -> str:
    if key in DIRECTION_ABNORMAL_FEATURES or z is None:
        return "ABNORMAL"
    return "HIGH" if z >= 0 else "LOW"


def extract_evidence(
    component_scores: dict,
    z_scores: dict,
    total_anomaly_score: float,
    top_n: int = 3,
) -> list[dict]:
    """
    Extract the top contributing features from the component anomaly scores.

    Parameters
    ----------
    component_scores : dict — feature_key → float or None (from anomaly_detector)
    z_scores         : dict — feature_key → float or None (from baseline)
    total_anomaly_score : float — the final combined anomaly score [0, 100]
    top_n            : int — number of top features to return

    Returns
    -------
    list of evidence dicts, sorted by contribution descending.
    Empty if total_anomaly_score == 0 or no components are available.
    """
    from .anomaly_detector import FEATURE_WEIGHTS

    if total_anomaly_score < 1e-6:
        return []

    active = {k: v for k, v in component_scores.items() if v is not None}
    if not active:
        return []

    total_weight = sum(FEATURE_WEIGHTS[k] for k in active)
    if total_weight < 1e-9:
        return []

    # Contribution = fraction of total anomaly score attributable to this feature
    contributions = {}
    for key, comp in active.items():
        # weighted contribution relative to total normalized score
        w = FEATURE_WEIGHTS[key]
        contributions[key] = (w * comp) / total_weight

    # Sort descending by contribution
    ranked = sorted(contributions.items(), key=lambda x: -x[1])

    evidence = []
    for key, contribution in ranked[:top_n]:
        if contribution < 1e-6:
            break
        z = z_scores.get(key)
        z_safe = None
        if z is not None and not (isinstance(z, float) and (math.isnan(z) or math.isinf(z))):
            z_safe = round(float(z), 4)

        evidence.append({
            "feature":      FEATURE_DISPLAY_NAMES.get(key, key),
            "direction":    _direction(key, z_scores.get(key)),
            "contribution": round(contribution, 4),
            "z_score":      z_safe,
        })

    return evidence
