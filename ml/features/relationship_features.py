"""
ml/features/relationship_features.py

TASK 2C — Cross-channel relationship features.

These are simple pairwise arithmetic relationships, computed only when both
input channels are present and non-null.

IMPORTANT:
  These are statistical associations — not causal claims.
  "pressure + flow ratio" does not imply a hydraulic model.
  "hookload - block_position covariance" does not imply a rig state.

All features return None if either input is missing. Missing is preserved.
"""

import math
from typing import Optional


def _safe_float(v) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    return float(v)


def _get_val(measurements: dict, field: str) -> Optional[float]:
    m = measurements.get(field)
    if m is None:
        return None
    return _safe_float(m.get("value"))


def compute_relationship_features(
    record: dict,
    history_df=None,  # pd.DataFrame — optional, used for rolling covariance
) -> dict:
    """
    Compute cross-channel relationship features for the current record.

    Parameters
    ----------
    record : dict
        Canonical NWIS telemetry record.
    history_df : pd.DataFrame or None
        Time-indexed DataFrame with canonical field columns.
        Required only for rolling covariance features.

    Returns
    -------
    dict of relationship features.
    """
    measurements = record.get("measurements", {})
    feats = {}

    sppa = _get_val(measurements, "standpipe_pressure")
    tflo = _get_val(measurements, "flow_rate")
    hkld = _get_val(measurements, "hookload")
    bpos = _get_val(measurements, "block_position")
    torq = _get_val(measurements, "torque")
    rpm  = _get_val(measurements, "rotary_speed")

    # --- Pressure / flow ratio ---
    # Observable relationship between pressure and flow readings.
    # Physically, standpipe pressure and flow rate are related through
    # pump dynamics, but we make NO physical model assumption here.
    if sppa is not None and tflo is not None and abs(tflo) > 1e-6:
        feats["pressure_flow_ratio"] = _safe_float(sppa / tflo)
    else:
        feats["pressure_flow_ratio"] = None

    # --- Pressure / flow difference (absolute) ---
    # Simple pairwise difference. Useful for detecting co-movement.
    if sppa is not None and tflo is not None:
        feats["pressure_flow_abs_diff"] = _safe_float(abs(sppa - tflo))
    else:
        feats["pressure_flow_abs_diff"] = None

    # --- Hookload / block-position relationship ---
    # Observable: block at high position vs. hookload value.
    if hkld is not None and bpos is not None:
        feats["hookload_bpos_diff"] = _safe_float(hkld - bpos)
    else:
        feats["hookload_bpos_diff"] = None

    # --- Torque / RPM product proxy ---
    # Observable mathematical product. No implied physical meaning.
    if torq is not None and rpm is not None:
        feats["torque_rpm_product"] = _safe_float(torq * rpm)
    else:
        feats["torque_rpm_product"] = None

    # --- Torque / RPM ratio ---
    if torq is not None and rpm is not None and abs(rpm) > 1e-6:
        feats["torque_rpm_ratio"] = _safe_float(torq / rpm)
    else:
        feats["torque_rpm_ratio"] = None

    # --- Rolling cross-channel features (require history) ---
    if history_df is not None and len(history_df) >= 3:
        import numpy as np
        import pandas as pd

        def _rolling_corr(col_a: str, col_b: str, window: str = "300s") -> Optional[float]:
            """Rolling correlation between two channels over a time window."""
            if col_a not in history_df.columns or col_b not in history_df.columns:
                return None
            a = history_df[col_a].dropna()
            b = history_df[col_b].dropna()
            # Align on common index
            common = a.index.intersection(b.index)
            if len(common) < 3:
                return None
            try:
                corr_series = history_df[col_a].rolling(window=window, min_periods=3).corr(history_df[col_b])
                v = corr_series.iloc[-1]
                return _safe_float(v)
            except Exception:
                return None

        feats["roll_medium_sppa_hkld_corr"]  = _rolling_corr("standpipe_pressure", "hookload")
        feats["roll_medium_bpos_hkld_corr"]  = _rolling_corr("block_position",     "hookload")
        feats["roll_medium_torque_rpm_corr"] = _rolling_corr("torque",              "rotary_speed")
        feats["roll_medium_sppa_flow_corr"]  = _rolling_corr("standpipe_pressure", "flow_rate")
    else:
        feats["roll_medium_sppa_hkld_corr"]  = None
        feats["roll_medium_bpos_hkld_corr"]  = None
        feats["roll_medium_torque_rpm_corr"] = None
        feats["roll_medium_sppa_flow_corr"]  = None

    return feats
