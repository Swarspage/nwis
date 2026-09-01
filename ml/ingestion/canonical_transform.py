"""
ml/ingestion/canonical_transform.py

NWIS Source Adapter: WELL-1 (VLOVE) → NWIS Canonical Telemetry Record

This module transforms raw WELL-1.csv rows into canonical NWIS telemetry records
conforming to schemas/nwis_telemetry.schema.json v0.1.0.

CONSTRAINTS:
- Does NOT modify the source CSV.
- Does NOT invent units.
- Does NOT claim GS_DBTM is verified depth.
- Canonical depth field is left null.
- Zero is NOT treated as missing.
- Source channel names are always preserved.
"""

import json
import math
import pandas as pd
from datetime import timezone
from pathlib import Path
from typing import Iterator

SCHEMA_VERSION = "0.1.0"
SOURCE_SYSTEM = "VLOVE"
SOURCE_WELL_ID = "WELL-1"
NWIS_WELL_ID = "WELL-1-VLOVE"
DATA_ORIGIN = "HISTORICAL_SOURCE"

# Timestamp boundaries of the known telemetry gap in WELL-1
# Determined by M0.2 analysis; the first row AFTER this boundary gets SOURCE_GAP
GAP_END_TIMESTAMP = pd.Timestamp("2008-12-22T03:53:32Z", tz="UTC")

# Mapping: canonical_field -> (source_column, quality_if_constant)
# quality_if_constant is used when the channel is known to be locked in this window
CHANNEL_MAP = {
    "rate_of_penetration": ("GS_ROP",  "CONSTANT_WINDOW"),
    "weight_on_bit":        ("GS_SWOB", None),  # zero is valid physical value
    "rotary_speed":         ("GS_RPM",  None),
    "torque":               ("GS_TQA",  None),
    "standpipe_pressure":   ("GS_SPPA", None),
    "flow_rate":            ("GS_TFLO", None),
    "hookload":             ("GS_HKLD", None),
    "block_position":       ("GS_BPOS", None),
}

# GS_DBTM is an unverified depth candidate; depth canonical field is left null.
DEPTH_CANDIDATE_CHANNEL = "GS_DBTM"

# Channels flagged as functionally constant in this window
CONSTANT_WINDOW_CHANNELS = {"GS_ROP", "GS_SWOB"}

def _classify_quality(value, source_col, is_gap_record: bool) -> str:
    """
    Assign per-measurement quality status.
    Priority: SOURCE_GAP > MISSING > ZERO > CONSTANT_WINDOW > UNVERIFIED
    """
    if is_gap_record:
        return "SOURCE_GAP"
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "MISSING"
    if value == 0.0:
        return "ZERO"
    if source_col in CONSTANT_WINDOW_CHANNELS:
        return "CONSTANT_WINDOW"
    return "UNVERIFIED"


def _make_measurement(value, source_col: str, is_gap_record: bool) -> dict:
    """Build a canonical Measurement object."""
    # Coerce NaN to None explicitly
    if isinstance(value, float) and math.isnan(value):
        numeric_val = None
    elif value is None:
        numeric_val = None
    else:
        numeric_val = float(value)

    quality = _classify_quality(numeric_val, source_col, is_gap_record)

    return {
        "value": numeric_val,
        "unit": None,
        "unit_status": "UNKNOWN",
        "source_channel": source_col,
        "quality": quality,
    }


def _determine_telemetry_status(measurements: dict) -> str:
    """
    Record-level telemetry status derived from measurement qualities.
    """
    qualities = [m["quality"] for m in measurements.values() if m is not None]
    if any(q == "SOURCE_GAP" for q in qualities):
        return "SOURCE_GAP"
    if all(q == "MISSING" for q in qualities):
        return "EMPTY"
    if any(q == "MISSING" for q in qualities):
        return "PARTIAL"
    return "VALID"


def transform_row(row: pd.Series, row_index: int) -> dict:
    """
    Transform a single WELL-1 DataFrame row into a canonical NWIS record.
    """
    ts = row["TIME"]
    if hasattr(ts, "isoformat"):
        ts_str = ts.isoformat()
    else:
        ts_str = str(ts)

    is_gap_record = (
        hasattr(ts, "tzinfo") and ts >= GAP_END_TIMESTAMP
        and abs((ts - GAP_END_TIMESTAMP).total_seconds()) < 10
    )

    measurements = {}

    # depth is explicitly null — no verified continuous depth channel
    measurements["depth"] = {
        "value": None,
        "unit": None,
        "unit_status": "UNKNOWN",
        "source_channel": None,
        "quality": "MISSING",
    }

    for canonical_field, (src_col, _) in CHANNEL_MAP.items():
        raw_val = row.get(src_col, float("nan"))
        measurements[canonical_field] = _make_measurement(raw_val, src_col, is_gap_record)

    telemetry_status = _determine_telemetry_status(measurements)

    return {
        "schema_version": SCHEMA_VERSION,
        "timestamp": ts_str,
        "well_id": NWIS_WELL_ID,
        "source_system": SOURCE_SYSTEM,
        "source_well_id": SOURCE_WELL_ID,
        "source_row_index": row_index,
        "data_origin": DATA_ORIGIN,
        "telemetry_status": telemetry_status,
        "measurements": measurements,
    }


def transform_dataframe(df: pd.DataFrame) -> Iterator[dict]:
    """Yield canonical records for each row in the DataFrame."""
    for idx, row in df.iterrows():
        yield transform_row(row, idx)


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent.parent
    data_path = repo_root / "data" / "raw" / "WELL-1.csv"
    output_path = repo_root / "data" / "processed" / "well1_canonical_sample.jsonl"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    print("Loading WELL-1...")
    df = pd.read_csv(data_path)
    df["TIME"] = pd.to_datetime(df["TIME"], utc=True)
    df = df.sort_values("TIME").reset_index(drop=True)

    # Sample: first 5 rows, last 5 rows, 2 rows around the gap (rows at gap)
    time_diffs = df["TIME"].diff().dt.total_seconds()
    gap_idx = int(time_diffs.idxmax())
    
    sample_indices = list(range(5)) + [gap_idx - 1, gap_idx] + list(range(len(df) - 3, len(df)))
    sample_indices = sorted(set(sample_indices))

    print(f"Generating sample from indices: {sample_indices}")
    with open(output_path, "w", encoding="utf-8") as f:
        for i in sample_indices:
            row = df.iloc[i]
            record = transform_row(row, i)
            f.write(json.dumps(record) + "\n")

    print(f"Wrote {len(sample_indices)} canonical records to {output_path}")
