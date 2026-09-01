"""
ml/features/feature_engine.py

NWIS Feature Engine — Orchestrator

Coordinates the four feature submodules:
  1. quality_features      — telemetry health
  2. signal_features       — per-channel rolling statistics and change detection
  3. state_features        — observable signal states
  4. relationship_features — cross-channel associations

Input:  list of canonical NWIS telemetry records (loaded from JSONL)
Output: feature records conforming to schemas/nwis_features.schema.json

LEAKAGE GUARANTEE:
  Rolling statistics use pandas time-based rolling windows. pandas rolling(window='Xs')
  at position t uses only data with timestamps in [t - X seconds, t]. No future rows leak.
  Signal features are computed as a single vectorized batch over the full DataFrame,
  which is equivalent to processing each record with only past data — pandas rolling
  does NOT look ahead by design.

MISSING-VALUE GUARANTEE:
  NaN is never written to output. All missing features are null (JSON null).
  Zero values are preserved as 0.

DEPTH FEATURES:
  Not computed. Canonical depth is null for WELL-1.
  See windows.DEPTH_UNAVAILABLE_REASON.
"""

import json
import math
from pathlib import Path
from typing import Iterator, List, Optional

import pandas as pd

from .windows import (
    FEATURE_VERSION,
    CANONICAL_MEASUREMENT_FIELDS,
    DEPTH_UNAVAILABLE_REASON,
)
from .quality_features import compute_quality_features
from .signal_features import compute_all_signal_features
from .state_features import compute_state_features
from .relationship_features import compute_relationship_features


def _safe_json(obj):
    """Recursively convert NaN/Inf to None for safe JSON serialization."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe_json(v) for v in obj]
    return obj


def _build_history_df(records: List[dict]) -> pd.DataFrame:
    """
    Build a time-indexed DataFrame of measurement values from canonical records.
    Missing values  → NaN (excluded from rolling stats).
    Zero values     → 0.0 (included in rolling stats; zero ≠ missing).
    """
    rows = []
    timestamps = []
    for rec in records:
        measurements = rec.get("measurements", {})
        row = {}
        for field in CANONICAL_MEASUREMENT_FIELDS:
            m = measurements.get(field)
            if m is None or m.get("value") is None:
                row[field] = float("nan")
            else:
                row[field] = float(m["value"])
        rows.append(row)
        timestamps.append(pd.Timestamp(rec["timestamp"]))

    return pd.DataFrame(rows, index=pd.DatetimeIndex(timestamps, name="timestamp"))


def process_records(records: List[dict]) -> Iterator[dict]:
    """
    Batch-process a list of canonical telemetry records, yielding one feature record each.

    Records must be sorted chronologically (ascending timestamp).

    Parameters
    ----------
    records : list of canonical NWIS telemetry dicts

    Yields
    ------
    dict — feature record (NaN/Inf sanitized to None)
    """
    if not records:
        return

    # Build full history DataFrame once — rolling ops are vectorized over all rows
    history_df = _build_history_df(records)

    # Single vectorized pass for signal features across all rows
    all_signal_feats = compute_all_signal_features(history_df)

    prev_ts: Optional[pd.Timestamp] = None

    for i, record in enumerate(records):
        ts = pd.Timestamp(record["timestamp"])

        q_feats  = compute_quality_features(record, prev_ts, CANONICAL_MEASUREMENT_FIELDS)
        st_feats = compute_state_features(record)
        # Pass only history up to and including current row for relationship rolling corr
        r_feats  = compute_relationship_features(record, history_df.iloc[: i + 1])

        feature_record = {
            "feature_version":       FEATURE_VERSION,
            "timestamp":             record["timestamp"],
            "well_id":               record["well_id"],
            "source_row_index":      record.get("source_row_index"),
            "data_origin":           record["data_origin"],
            "telemetry_status":      record["telemetry_status"],
            "quality_features":      q_feats,
            "signal_features":       all_signal_feats[i],
            "state_features":        st_feats,
            "relationship_features": r_feats,
        }

        yield _safe_json(feature_record)
        prev_ts = ts


def process_jsonl_file(
    input_path: Path,
    output_path: Path,
    limit: Optional[int] = None,
):
    """
    Read canonical records from a JSONL file, compute features, write to output JSONL.

    Parameters
    ----------
    input_path  : Path to canonical JSONL file
    output_path : Path to write feature JSONL
    limit       : Optional maximum records to process (None = all)
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    records = []
    with open(input_path, encoding="utf-8") as f:
        for i, line in enumerate(f):
            if limit is not None and i >= limit:
                break
            line = line.strip()
            if line:
                records.append(json.loads(line))

    print(f"Loaded {len(records)} canonical records. Computing features...")

    with open(output_path, "w", encoding="utf-8") as out:
        for feat_record in process_records(records):
            out.write(json.dumps(feat_record) + "\n")

    print(f"Feature records written to {output_path}")


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent.parent
    full_path   = repo_root / "data" / "processed" / "well1_canonical_full.jsonl"
    sample_path = repo_root / "data" / "processed" / "well1_canonical_sample.jsonl"
    output_path = repo_root / "data" / "processed" / "well1_feature_sample.jsonl"

    input_path = full_path if full_path.exists() else sample_path
    print(f"Reading from: {input_path}")
    process_jsonl_file(input_path, output_path)
    print(f"Done: {output_path}")
