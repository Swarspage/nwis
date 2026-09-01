"""
ml/features/quality_features.py

TASK 2D + TASK 5 — Data-quality and telemetry-health features.

These features describe the health and reliability of each canonical record,
not the physical process. They are the first features evaluated before any
signal-level analysis.

All features are computed from canonical record metadata alone; no signal
values are used here.
"""

from datetime import timezone
from typing import Optional
import pandas as pd
from .windows import GAP_THRESHOLD_SEC


def compute_quality_features(
    record: dict,
    prev_timestamp: Optional[pd.Timestamp],
    measurement_fields: list[str],
) -> dict:
    """
    Compute telemetry health / data quality features for a single canonical record.

    Parameters
    ----------
    record : dict
        A canonical NWIS telemetry record.
    prev_timestamp : pd.Timestamp or None
        Timestamp of the preceding record in the time-ordered stream.
        None for the first record.
    measurement_fields : list[str]
        The canonical measurement fields to evaluate for coverage.

    Returns
    -------
    dict with quality feature values.
    """
    measurements = record.get("measurements", {})
    ts = pd.Timestamp(record["timestamp"])

    # --- Time delta ---
    if prev_timestamp is not None:
        time_delta_seconds = (ts - prev_timestamp).total_seconds()
    else:
        time_delta_seconds = None  # first record

    # Abnormal interval flag
    # Threshold is documented in windows.py: 5× dataset p99 inter-sample interval
    if time_delta_seconds is not None:
        time_gap_flag = 1 if time_delta_seconds > GAP_THRESHOLD_SEC else 0
    else:
        time_gap_flag = None  # cannot determine for first record

    # --- Channel coverage ---
    present_channels = 0
    missing_channels = 0
    for field in measurement_fields:
        m = measurements.get(field)
        if m is None:
            missing_channels += 1
        elif m.get("value") is not None:
            present_channels += 1
        else:
            missing_channels += 1

    total_channels = len(measurement_fields)
    telemetry_completeness = (
        present_channels / total_channels if total_channels > 0 else None
    )

    # --- Source-gap indicator ---
    source_gap_flag = 1 if record.get("telemetry_status") == "SOURCE_GAP" else 0

    return {
        "time_delta_seconds":      time_delta_seconds,
        "time_gap_flag":           time_gap_flag,
        "source_gap_flag":         source_gap_flag,
        "present_channel_count":   present_channels,
        "missing_channel_count":   missing_channels,
        "telemetry_completeness":  telemetry_completeness,
        # Metadata for interpretation
        "_gap_threshold_seconds":  GAP_THRESHOLD_SEC,
        "_total_channels_checked": total_channels,
    }
