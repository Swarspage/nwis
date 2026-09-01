"""
ml/ingestion/validate_canonical.py

NWIS Canonical Record Validator

Validates that a canonical telemetry record conforms to the NWIS schema v0.1.0.
Includes a built-in test suite with both valid and deliberately invalid records.

Run directly to execute tests:
    python validate_canonical.py
"""

import json
import math
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "0.1.0"
VALID_DATA_ORIGINS = {"HISTORICAL_SOURCE", "SYNTHETIC_DEMO", "FUTURE_LIVE_SOURCE"}
VALID_TELEMETRY_STATUSES = {"VALID", "SOURCE_GAP", "PARTIAL", "EMPTY", "DATA_ARTIFACT"}
VALID_QUALITY_VALUES = {"VALID", "MISSING", "SOURCE_GAP", "INVALID_SOURCE_VALUE", "UNVERIFIED", "CONSTANT_WINDOW", "ZERO"}
VALID_UNIT_STATUSES = {"VERIFIED", "ASSUMED", "UNKNOWN"}
CANONICAL_MEASUREMENT_FIELDS = {
    "depth", "rate_of_penetration", "weight_on_bit", "rotary_speed",
    "torque", "standpipe_pressure", "flow_rate", "hookload", "block_position"
}


class ValidationError(Exception):
    pass


def _fail(msg: str):
    raise ValidationError(msg)


def validate_measurement(field_name: str, meas: Any):
    if not isinstance(meas, dict):
        _fail(f"[{field_name}] measurement must be a dict, got {type(meas)}")

    # value: numeric or null
    val = meas.get("value", "ABSENT")
    if val != "ABSENT":
        if val is not None and not isinstance(val, (int, float)):
            _fail(f"[{field_name}] value must be numeric or null, got {type(val)}")
        if isinstance(val, float) and math.isnan(val):
            _fail(f"[{field_name}] value must not be NaN — use null for missing")

    # unit_status required
    us = meas.get("unit_status")
    if us not in VALID_UNIT_STATUSES:
        _fail(f"[{field_name}] unit_status '{us}' is not valid. Must be one of {VALID_UNIT_STATUSES}")

    # quality required
    quality = meas.get("quality")
    if quality not in VALID_QUALITY_VALUES:
        _fail(f"[{field_name}] quality '{quality}' is not valid. Must be one of {VALID_QUALITY_VALUES}")

    # Invariant: MISSING quality must have null value
    if quality == "MISSING" and val is not None:
        _fail(f"[{field_name}] quality=MISSING but value={val}. MISSING must have null value.")

    # Invariant: ZERO quality must have value == 0
    if quality == "ZERO" and val != 0:
        _fail(f"[{field_name}] quality=ZERO but value={val}. ZERO quality requires value=0.")

    # Invariant: non-MISSING quality should not have null value
    # (except for SOURCE_GAP and CONSTANT_WINDOW which may have null on sensor dropout)
    if quality not in {"MISSING", "SOURCE_GAP"} and val is None:
        _fail(
            f"[{field_name}] quality='{quality}' but value=null. "
            f"Non-MISSING quality must have a numeric value."
        )


def validate_canonical_record(record: dict) -> bool:
    """
    Validates a single canonical NWIS telemetry record.
    Returns True if valid, raises ValidationError otherwise.
    """

    # --- Schema version ---
    sv = record.get("schema_version")
    if not sv:
        _fail("schema_version is missing")
    if sv != SCHEMA_VERSION:
        _fail(f"schema_version '{sv}' is unsupported. Expected '{SCHEMA_VERSION}'")

    # --- Timestamp ---
    ts = record.get("timestamp")
    if not ts or not isinstance(ts, str) or len(ts) < 10:
        _fail(f"timestamp is missing or invalid: {ts!r}")

    # --- well_id ---
    well_id = record.get("well_id")
    if not well_id or not isinstance(well_id, str) or not well_id.strip():
        _fail(f"well_id is missing or empty: {well_id!r}")

    # --- source_system ---
    ss = record.get("source_system")
    if not ss or not isinstance(ss, str) or not ss.strip():
        _fail(f"source_system is missing or empty: {ss!r}")

    # --- source_well_id ---
    swi = record.get("source_well_id")
    if not swi or not isinstance(swi, str) or not swi.strip():
        _fail(f"source_well_id is missing or empty: {swi!r}")

    # --- data_origin ---
    do = record.get("data_origin")
    if do not in VALID_DATA_ORIGINS:
        _fail(f"data_origin '{do}' is not valid. Must be one of {VALID_DATA_ORIGINS}")

    # --- telemetry_status ---
    ts_status = record.get("telemetry_status")
    if ts_status not in VALID_TELEMETRY_STATUSES:
        _fail(f"telemetry_status '{ts_status}' is not valid. Must be one of {VALID_TELEMETRY_STATUSES}")

    # --- source_row_index: if present, must be integer >= 0 ---
    sri = record.get("source_row_index")
    if sri is not None:
        if not isinstance(sri, int) or sri < 0:
            _fail(f"source_row_index must be a non-negative integer or null, got {sri!r}")

    # --- measurements ---
    meas = record.get("measurements")
    if meas is not None:
        if not isinstance(meas, dict):
            _fail("measurements must be an object (dict)")

        # Only canonical fields are allowed
        unexpected = set(meas.keys()) - CANONICAL_MEASUREMENT_FIELDS
        if unexpected:
            _fail(f"measurements contains unexpected fields: {unexpected}")

        for field_name, m in meas.items():
            validate_measurement(field_name, m)

        # EMPTY status must have all null values
        if ts_status == "EMPTY":
            for field_name, m in meas.items():
                if m.get("value") is not None:
                    _fail(
                        f"telemetry_status=EMPTY but [{field_name}] has non-null value. "
                        f"All measurements must be null for EMPTY records."
                    )

        # PARTIAL: at least one null and one non-null
        if ts_status == "PARTIAL":
            vals = [m.get("value") for m in meas.values()]
            if not any(v is None for v in vals):
                _fail("telemetry_status=PARTIAL but no null values found in measurements.")
            if all(v is None for v in vals):
                _fail("telemetry_status=PARTIAL but all values are null — should be EMPTY.")

        # Depth is allowed to be null
        depth = meas.get("depth")
        if depth is not None and depth.get("quality") == "MISSING" and depth.get("value") is not None:
            _fail("depth quality=MISSING but value is not null.")

    return True


# ─── Test Suite ─────────────────────────────────────────────────────────────

def _make_measurement(value, quality, unit_status="UNKNOWN", source_channel="GS_TEST"):
    return {
        "value": value,
        "unit": None,
        "unit_status": unit_status,
        "source_channel": source_channel,
        "quality": quality,
    }


VALID_RECORD = {
    "schema_version": "0.1.0",
    "timestamp": "2008-12-21T17:21:32Z",
    "well_id": "WELL-1-VLOVE",
    "source_system": "VLOVE",
    "source_well_id": "WELL-1",
    "source_row_index": 0,
    "data_origin": "HISTORICAL_SOURCE",
    "telemetry_status": "VALID",
    "measurements": {
        "depth":                {"value": None, "unit": None, "unit_status": "UNKNOWN", "source_channel": None, "quality": "MISSING"},
        "hookload":             _make_measurement(64.88, "UNVERIFIED", source_channel="GS_HKLD"),
        "standpipe_pressure":   _make_measurement(112.99, "UNVERIFIED", source_channel="GS_SPPA"),
        "block_position":       _make_measurement(1.0, "UNVERIFIED", source_channel="GS_BPOS"),
        "weight_on_bit":        _make_measurement(0.0, "ZERO", source_channel="GS_SWOB"),
        "rotary_speed":         _make_measurement(0.0, "ZERO", source_channel="GS_RPM"),
        "torque":               _make_measurement(0.02, "UNVERIFIED", source_channel="GS_TQA"),
        "flow_rate":            _make_measurement(0.0, "ZERO", source_channel="GS_TFLO"),
        "rate_of_penetration":  _make_measurement(10.26, "CONSTANT_WINDOW", source_channel="GS_ROP"),
    }
}

TEST_CASES = [
    {
        "name": "Valid record with all fields",
        "record": VALID_RECORD,
        "expect_valid": True,
    },
    {
        "name": "Valid SYNTHETIC_DEMO record",
        "record": {**VALID_RECORD, "data_origin": "SYNTHETIC_DEMO", "source_system": "NWIS_SIMULATOR"},
        "expect_valid": True,
    },
    {
        "name": "Valid SOURCE_GAP record",
        "record": {
            **VALID_RECORD,
            "telemetry_status": "SOURCE_GAP",
            "measurements": {
                "depth": {"value": None, "unit": None, "unit_status": "UNKNOWN", "source_channel": None, "quality": "MISSING"},
                "hookload": {"value": None, "unit": None, "unit_status": "UNKNOWN", "source_channel": "GS_HKLD", "quality": "SOURCE_GAP"},
            }
        },
        "expect_valid": True,
    },
    {
        "name": "Valid PARTIAL record",
        "record": {
            **VALID_RECORD,
            "telemetry_status": "PARTIAL",
            "measurements": {
                "depth": {"value": None, "unit": None, "unit_status": "UNKNOWN", "source_channel": None, "quality": "MISSING"},
                "hookload": _make_measurement(64.88, "UNVERIFIED", source_channel="GS_HKLD"),
            }
        },
        "expect_valid": True,
    },
    {
        "name": "Valid EMPTY record",
        "record": {
            **VALID_RECORD,
            "telemetry_status": "EMPTY",
            "measurements": {
                "depth": {"value": None, "unit": None, "unit_status": "UNKNOWN", "source_channel": None, "quality": "MISSING"},
                "hookload": {"value": None, "unit": None, "unit_status": "UNKNOWN", "source_channel": "GS_HKLD", "quality": "MISSING"},
            }
        },
        "expect_valid": True,
    },
    {
        "name": "INVALID: missing schema_version",
        "record": {k: v for k, v in VALID_RECORD.items() if k != "schema_version"},
        "expect_valid": False,
    },
    {
        "name": "INVALID: wrong schema_version",
        "record": {**VALID_RECORD, "schema_version": "9.9.9"},
        "expect_valid": False,
    },
    {
        "name": "INVALID: missing well_id",
        "record": {**VALID_RECORD, "well_id": ""},
        "expect_valid": False,
    },
    {
        "name": "INVALID: bad data_origin",
        "record": {**VALID_RECORD, "data_origin": "INVENTED_ORIGIN"},
        "expect_valid": False,
    },
    {
        "name": "INVALID: bad telemetry_status",
        "record": {**VALID_RECORD, "telemetry_status": "UNKNOWN_STATUS"},
        "expect_valid": False,
    },
    {
        "name": "INVALID: NaN value instead of null",
        "record": {
            **VALID_RECORD,
            "measurements": {
                **VALID_RECORD["measurements"],
                "hookload": _make_measurement(float("nan"), "UNVERIFIED", source_channel="GS_HKLD"),
            }
        },
        "expect_valid": False,
    },
    {
        "name": "INVALID: MISSING quality with non-null value",
        "record": {
            **VALID_RECORD,
            "measurements": {
                **VALID_RECORD["measurements"],
                "hookload": _make_measurement(64.88, "MISSING", source_channel="GS_HKLD"),
            }
        },
        "expect_valid": False,
    },
    {
        "name": "INVALID: ZERO quality with non-zero value",
        "record": {
            **VALID_RECORD,
            "measurements": {
                **VALID_RECORD["measurements"],
                "hookload": _make_measurement(12.5, "ZERO", source_channel="GS_HKLD"),
            }
        },
        "expect_valid": False,
    },
    {
        "name": "INVALID: UNVERIFIED quality with null value",
        "record": {
            **VALID_RECORD,
            "measurements": {
                **VALID_RECORD["measurements"],
                "hookload": _make_measurement(None, "UNVERIFIED", source_channel="GS_HKLD"),
            }
        },
        "expect_valid": False,
    },
    {
        "name": "INVALID: bad quality value",
        "record": {
            **VALID_RECORD,
            "measurements": {
                **VALID_RECORD["measurements"],
                "hookload": _make_measurement(64.88, "PERFECT", source_channel="GS_HKLD"),
            }
        },
        "expect_valid": False,
    },
    {
        "name": "INVALID: unexpected measurement field",
        "record": {
            **VALID_RECORD,
            "measurements": {
                **VALID_RECORD["measurements"],
                "invented_channel": _make_measurement(99.9, "VALID", source_channel="GS_X"),
            }
        },
        "expect_valid": False,
    },
    {
        "name": "INVALID: EMPTY status with non-null measurement",
        "record": {
            **VALID_RECORD,
            "telemetry_status": "EMPTY",
            "measurements": {
                "hookload": _make_measurement(64.88, "UNVERIFIED", source_channel="GS_HKLD"),
                "depth": {"value": None, "unit": None, "unit_status": "UNKNOWN", "source_channel": None, "quality": "MISSING"},
            }
        },
        "expect_valid": False,
    },
    {
        "name": "INVALID: negative source_row_index",
        "record": {**VALID_RECORD, "source_row_index": -5},
        "expect_valid": False,
    },
]


def run_tests():
    passed = 0
    failed = 0
    errors = []

    for tc in TEST_CASES:
        name = tc["name"]
        record = tc["record"]
        expect_valid = tc["expect_valid"]

        try:
            validate_canonical_record(record)
            result_valid = True
        except ValidationError as e:
            result_valid = False
            err_msg = str(e)
        except Exception as e:
            result_valid = False
            err_msg = f"UNEXPECTED EXCEPTION: {e}"

        if result_valid == expect_valid:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            if expect_valid:
                print(f"  [FAIL] {name} — expected VALID but got INVALID: {err_msg}")
            else:
                print(f"  [FAIL] {name} — expected INVALID but got VALID")
            failed += 1
            errors.append(name)

    print(f"\n  Results: {passed}/{passed+failed} passed.")
    if errors:
        print(f"  FAILED: {errors}")
        return False
    return True


if __name__ == "__main__":
    print("=== NWIS Canonical Validator Test Suite ===\n")
    success = run_tests()

    # Also validate the sample file if it exists
    repo_root = Path(__file__).resolve().parent.parent.parent
    sample_path = repo_root / "data" / "processed" / "well1_canonical_sample.jsonl"

    if sample_path.exists():
        print(f"\n=== Validating sample file: {sample_path.name} ===")
        n_valid = 0
        n_invalid = 0
        with open(sample_path, encoding="utf-8") as f:
            for line_no, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    validate_canonical_record(record)
                    print(f"  Line {line_no}: [VALID] (row_index={record.get('source_row_index')}, ts={record.get('timestamp')}, status={record.get('telemetry_status')})")
                    n_valid += 1
                except ValidationError as e:
                    print(f"  Line {line_no}: [INVALID] — {e}")
                    n_invalid += 1

        print(f"\n  Sample file: {n_valid} valid, {n_invalid} invalid.")
    else:
        print(f"\n[INFO] Sample file not found at {sample_path}. Run canonical_transform.py first.")

    if not success:
        raise SystemExit(1)
