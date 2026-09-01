"""
ml/intelligence/baseline.py

Causal rolling robust baseline for the NWIS intelligence layer.

Computes per-feature robust z-scores using a rolling window of historical
feature values at or before the current timestamp.

Method: robust z-score = (x - rolling_median) / (1.4826 * rolling_MAD)
  - 1.4826 is the consistency factor making MAD comparable to σ for normal data
  - rolling_median and rolling_MAD are computed from the past BASELINE_WINDOW records
  - When n < MIN_BASELINE_OBS, z-score is set to 0 (insufficient history)

LEAKAGE GUARANTEE:
  The baseline is built incrementally. At position i, only records 0..i are used.
  No future data ever enters the baseline calculation.

ZERO / MISSING POLICY:
  - Missing (None) values are excluded from baseline accumulation
  - Zero values are included (zero is a valid signal state)
"""

from typing import Optional
import math


BASELINE_WINDOW = 60     # number of past records to use for rolling baseline
MIN_BASELINE_OBS = 3     # minimum observations needed before z-score is meaningful
CONSISTENCY_FACTOR = 1.4826  # converts MAD to comparable σ for normal distributions


def _safe(v) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _median(vals: list) -> Optional[float]:
    if not vals:
        return None
    s = sorted(vals)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 == 1 else (s[mid - 1] + s[mid]) / 2.0


def _mad(vals: list, med: float) -> float:
    if not vals:
        return 0.0
    return _median([abs(v - med) for v in vals]) or 0.0


def robust_z(value: Optional[float], history: list) -> Optional[float]:
    """
    Compute robust z-score of `value` relative to `history`.

    Parameters
    ----------
    value : float or None
        The current observation.
    history : list of float
        Historical values (non-null, already validated).
        Must contain only past observations (causal).

    Returns
    -------
    float or None
        Robust z-score. None if value is missing or insufficient history.
    """
    v = _safe(value)
    if v is None:
        return None

    valid_history = [h for h in history if h is not None]
    if len(valid_history) < MIN_BASELINE_OBS:
        return None  # insufficient baseline — flagged in quality_flags.insufficient_baseline

    med = _median(valid_history)
    mad = _mad(valid_history, med)

    if mad < 1e-9:
        # Nearly constant signal — any deviation is large
        diff = abs(v - med)
        if diff < 1e-6:
            return 0.0
        # Cap at a large but finite z to avoid inf
        return min(10.0, diff)

    return (v - med) / (CONSISTENCY_FACTOR * mad)


class RollingBaseline:
    """
    Maintains a causal rolling window of historical values for a set of feature keys.

    Usage:
        baseline = RollingBaseline(window=60)
        baseline.push(feature_values_dict)       # add current record's values
        z_scores = baseline.z_scores(feature_values_dict)  # compute z-scores
    """

    def __init__(self, window: int = BASELINE_WINDOW):
        self._window = window
        self._histories: dict[str, list] = {}

    def push(self, values: dict):
        """
        Add current record's feature values into the rolling history AFTER scoring.

        STRICT ORDERING INVARIANT:
            For record at time t:
                1. Call z_scores(current_values)   ← uses history [0 .. t-1]
                2. Call push(current_values)        ← adds t into history for future records

            Calling push() BEFORE z_scores() for the same record violates this
            invariant and constitutes look-ahead leakage. The intelligence engine
            enforces this order; tests verify it explicitly.
        """
        for key, val in values.items():
            v = _safe(val)
            if v is None:
                continue  # missing values don't accumulate in baseline
            if key not in self._histories:
                self._histories[key] = []
            self._histories[key].append(v)
            # Trim to window size
            if len(self._histories[key]) > self._window:
                self._histories[key] = self._histories[key][-self._window:]

    def z_scores(self, values: dict) -> dict:
        """
        Compute robust z-scores for each feature in values dict,
        using only the history accumulated SO FAR (i.e., not including current values).

        Returns dict: feature_key → z_score (float or None)
        """
        result = {}
        for key, val in values.items():
            history = self._histories.get(key, [])
            result[key] = robust_z(_safe(val), history)
        return result

    def has_sufficient_baseline(self, key: str) -> bool:
        return len(self._histories.get(key, [])) >= MIN_BASELINE_OBS
