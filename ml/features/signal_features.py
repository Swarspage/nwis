"""
ml/features/signal_features.py

TASK 2A + TASK 4 — Signal features and change features.

Computes per-channel:
  - current value
  - rolling mean / std / min / max  (short, medium, long windows in seconds)
  - rolling median (via quantile — vectorized)
  - first difference (exact delta)
  - absolute first difference
  - meaningful-change indicator  (|delta| > tolerance)
  - rolling change frequency

LEAKAGE SAFEGUARD:
  compute_all_signal_features() does a SINGLE vectorized pass over the full
  history DataFrame and returns one feature dict per row. This avoids the
  O(N²) per-row rolling.apply() bottleneck while preserving the invariant
  that row[t] only uses data at timestamps <= t.

MISSING-VALUE POLICY:
  - NaN in history_df = missing; excluded from rolling stats.
  - 0.0 in history_df = zero observation; included in rolling stats.

DEPTH FEATURES:
  Not computed. See windows.DEPTH_UNAVAILABLE_REASON.
"""

import math
from typing import Optional
import pandas as pd
import numpy as np
from .windows import SHORT_WINDOW_SEC, MEDIUM_WINDOW_SEC, LONG_WINDOW_SEC, CANONICAL_MEASUREMENT_FIELDS

MEANINGFUL_CHANGE_TOLERANCE = {
    "rate_of_penetration": 1e-4,
    "weight_on_bit":       1e-4,
    "rotary_speed":        1e-4,
    "torque":              1e-4,
    "standpipe_pressure":  7.05,
    "flow_rate":           1e-4,
    "hookload":            0.0184,
    "block_position":      0.05,
}

WINDOWS = {
    "short":  SHORT_WINDOW_SEC,
    "medium": MEDIUM_WINDOW_SEC,
    "long":   LONG_WINDOW_SEC,
}


def _safe_float(v) -> Optional[float]:
    """Return float or None. Never return NaN."""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def compute_all_signal_features(history_df: pd.DataFrame) -> list[dict]:
    """
    Vectorized batch computation over the full time-ordered history DataFrame.

    Parameters
    ----------
    history_df : pd.DataFrame
        Time-indexed (UTC), columns = canonical field names, values = float / NaN.
        Must be sorted ascending by timestamp. Must NOT contain any future rows.

    Returns
    -------
    list of dicts, one per row in history_df, each containing signal features
    keyed by field name.
    """
    n = len(history_df)
    # Pre-build result structure
    result = [{} for _ in range(n)]

    for field in CANONICAL_MEASUREMENT_FIELDS:
        tol = MEANINGFUL_CHANGE_TOLERANCE.get(field, 1e-4)

        if field not in history_df.columns:
            for i in range(n):
                result[i][field] = _null_field(field, tol)
            continue

        col = history_df[field]  # pd.Series, NaN for missing

        # --- First differences (between consecutive valid observations) ---
        # Shift gives the previous row; NaN rows propagated naturally
        delta_s     = col.diff()          # NaN if current or prev is NaN
        abs_delta_s = delta_s.abs()
        meaningful_s = (abs_delta_s > tol).astype("Int64")  # nullable int
        # Where delta is NaN, meaningful change is undefined
        meaningful_s = meaningful_s.where(delta_s.notna(), other=pd.NA)

        # --- Rolling statistics (vectorized, time-based windows) ---
        roll_stats = {}
        for win_label, win_sec in WINDOWS.items():
            w = f"{win_sec}s"
            roll = col.rolling(window=w, min_periods=1)
            roll_stats[win_label] = {
                "mean":  roll.mean(),
                "std":   roll.std(ddof=1),
                "min":   roll.min(),
                "max":   roll.max(),
                # quantile(0.5) = median; faster than apply(np.median)
                "median": roll.quantile(0.5, interpolation="midpoint"),
                "n_obs": roll.count().astype(int),
            }

        # --- Rolling change frequency (long window, vectorized) ---
        long_w = f"{WINDOWS['long']}s"
        # Sum of meaningful changes in window / count of valid obs in window
        meaningful_float = abs_delta_s.gt(tol).astype(float).where(col.notna(), other=float("nan"))
        chg_sum  = meaningful_float.rolling(window=long_w, min_periods=2).sum()
        chg_cnt  = col.rolling(window=long_w, min_periods=2).count()
        chg_freq = (chg_sum / chg_cnt).where(chg_cnt > 0)

        # --- Populate per-row results ---
        for i in range(n):
            v = _safe_float(col.iloc[i])
            d = _safe_float(delta_s.iloc[i])
            ad = _safe_float(abs_delta_s.iloc[i])

            mc_raw = meaningful_s.iloc[i]
            mc = None if pd.isna(mc_raw) else int(mc_raw)

            feats = {
                "current_value": v,
                "delta": d,
                "abs_delta": ad,
                "meaningful_change": mc,
                "meaningful_change_tolerance": tol,
                "roll_long_change_frequency": _safe_float(chg_freq.iloc[i]),
            }
            for win_label, stats in roll_stats.items():
                for stat_name, stat_series in stats.items():
                    raw = stat_series.iloc[i]
                    if stat_name == "n_obs":
                        feats[f"roll_{win_label}_{stat_name}"] = int(raw)
                    else:
                        feats[f"roll_{win_label}_{stat_name}"] = _safe_float(raw)

            result[i][field] = feats

    # Depth explicitly unavailable for every row
    for i in range(n):
        result[i]["depth"] = {
            "current_value": None,
            "_unavailable_reason": "No verified continuous depth channel in WELL-1.",
        }

    return result


def _null_field(field: str, tol: float) -> dict:
    """Return an all-null feature dict for a field not present in the history."""
    feats = {
        "current_value": None,
        "delta": None,
        "abs_delta": None,
        "meaningful_change": None,
        "meaningful_change_tolerance": tol,
        "roll_long_change_frequency": None,
    }
    for win_label in WINDOWS:
        for stat_name in ("mean", "median", "std", "min", "max", "n_obs"):
            feats[f"roll_{win_label}_{stat_name}"] = None
    return feats


def compute_signal_features(record: dict, history_df: pd.DataFrame) -> dict:
    """
    Single-record wrapper around compute_all_signal_features.
    Used by the streaming per-record path in feature_engine.py.
    Returns the feature dict for the LAST row of history_df (the current record).
    """
    if len(history_df) == 0:
        out = {}
        for field in CANONICAL_MEASUREMENT_FIELDS:
            out[field] = _null_field(field, MEANINGFUL_CHANGE_TOLERANCE.get(field, 1e-4))
        out["depth"] = {"current_value": None,
                        "_unavailable_reason": "No verified continuous depth channel in WELL-1."}
        return out

    all_feats = compute_all_signal_features(history_df)
    return all_feats[-1]  # features for the current (last) row
