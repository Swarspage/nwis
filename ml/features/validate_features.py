"""
ml/features/validate_features.py

Validation tests for the NWIS feature engineering layer.

Tests:
  1. Timestamps remain ordered
  2. well_id is preserved
  3. Provenance (source_row_index, data_origin) is preserved
  4. Missing values are not converted to zero
  5. Zero remains zero (not converted to null)
  6. Rolling features do not leak future observations
  7. Features at time t only use data available at or before t
  8. Source-gap indicators work
  9. Depth features remain unavailable/null
 10. No NaN or Inf in output
 11. Quality feature computations are correct
"""

import json
import math
import sys
from pathlib import Path

# Add parent to sys.path for import
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.features.feature_engine import process_records


PASS = "[PASS]"
FAIL = "[FAIL]"


def _no_nan_inf(obj, path="root") -> list:
    """Recursively find any NaN or Inf in a nested dict/list. Returns list of offending paths."""
    issues = []
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            issues.append(f"{path} = {obj}")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            issues.extend(_no_nan_inf(v, f"{path}.{k}"))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            issues.extend(_no_nan_inf(v, f"{path}[{i}]"))
    return issues


def run_tests():
    results = []

    # ── Build test canonical records ──────────────────────────────────────────
    def _make_record(ts, row_idx, well_id="WELL-1-VLOVE", status="VALID",
                     data_origin="HISTORICAL_SOURCE",
                     hkld=None, bpos=None, rpm=None, torq=None, sppa=None, flow=None,
                     rop=10.26, wob=0.0, source_gap=False):
        def _m(val, src_ch, quality=None):
            if val is None:
                q = "MISSING"
            elif val == 0.0:
                q = "ZERO"
            else:
                q = "UNVERIFIED"
            if quality:
                q = quality
            return {"value": val, "unit": None, "unit_status": "UNKNOWN",
                    "source_channel": src_ch, "quality": "SOURCE_GAP" if source_gap else q}

        def _mrop(val):
            return {"value": val, "unit": None, "unit_status": "UNKNOWN",
                    "source_channel": "GS_ROP", "quality": "SOURCE_GAP" if source_gap else "CONSTANT_WINDOW"}

        return {
            "schema_version": "0.1.0",
            "timestamp": ts,
            "well_id": well_id,
            "source_system": "VLOVE",
            "source_well_id": "WELL-1",
            "source_row_index": row_idx,
            "data_origin": data_origin,
            "telemetry_status": "SOURCE_GAP" if source_gap else status,
            "measurements": {
                "depth": {"value": None, "unit": None, "unit_status": "UNKNOWN",
                          "source_channel": None, "quality": "MISSING"},
                "rate_of_penetration": _mrop(rop),
                "weight_on_bit":       _m(wob, "GS_SWOB"),
                "rotary_speed":        _m(rpm, "GS_RPM"),
                "torque":              _m(torq, "GS_TQA"),
                "standpipe_pressure":  _m(sppa, "GS_SPPA"),
                "flow_rate":           _m(flow, "GS_TFLO"),
                "hookload":            _m(hkld, "GS_HKLD"),
                "block_position":      _m(bpos, "GS_BPOS"),
            }
        }

    records_normal = [
        _make_record("2008-12-21T17:21:36Z", 1, hkld=70.69, bpos=23.46, rpm=0.0,
                     torq=0.02, sppa=1338.0, flow=1999.5),
        _make_record("2008-12-21T17:21:41Z", 2, hkld=71.13, bpos=23.46, rpm=0.0,
                     torq=0.02, sppa=1325.0, flow=1999.5),
        _make_record("2008-12-21T17:21:46Z", 3, hkld=71.50, bpos=22.10, rpm=0.0,
                     torq=0.02, sppa=1310.0, flow=1999.5),
        _make_record("2008-12-21T17:21:51Z", 4, hkld=70.90, bpos=21.50, rpm=0.0,
                     torq=0.02, sppa=1290.0, flow=1999.5),
    ]
    record_missing = _make_record("2008-12-21T17:26:51Z", 5,
                                   hkld=None, bpos=None, rpm=None, torq=None,
                                   sppa=None, flow=None, status="EMPTY")
    record_zero   = _make_record("2008-12-21T17:26:56Z", 6,
                                  hkld=65.0, bpos=0.0, rpm=0.0,
                                  torq=0.02, sppa=200.0, flow=0.0)
    record_gap    = _make_record("2008-12-22T03:53:32Z", 7,
                                  hkld=None, bpos=0.0, rpm=None,
                                  torq=None, sppa=254.0, flow=0.0,
                                  source_gap=True)

    all_records = records_normal + [record_missing, record_zero, record_gap]
    feature_records = list(process_records(all_records))

    # ── TEST 1: Timestamps remain ordered ────────────────────────────────────
    tss = [r["timestamp"] for r in feature_records]
    ordered = all(tss[i] <= tss[i+1] for i in range(len(tss)-1))
    results.append((
        "Timestamps remain ordered",
        ordered,
        "" if ordered else f"Out-of-order pair found"
    ))

    # ── TEST 2: well_id preserved ─────────────────────────────────────────────
    well_ok = all(r["well_id"] == "WELL-1-VLOVE" for r in feature_records)
    results.append(("well_id is preserved in every feature record", well_ok, ""))

    # ── TEST 3: Provenance preserved ──────────────────────────────────────────
    source_rows = [r["source_row_index"] for r in feature_records]
    expected    = [rec["source_row_index"] for rec in all_records]
    prov_ok = source_rows == expected
    results.append(("source_row_index (provenance) preserved", prov_ok,
                     f"got {source_rows}" if not prov_ok else ""))

    # ── TEST 4: Missing values not converted to zero ──────────────────────────
    # record_missing has all null measurements; all signal current_value should be None
    # record_missing is index 4 in all_records
    missing_feat = feature_records[4]
    signals = missing_feat["signal_features"]
    missing_ok = True
    for field in ["hookload", "standpipe_pressure", "rotary_speed"]:
        cv = signals.get(field, {}).get("current_value")
        if cv == 0:
            missing_ok = False
            break
    results.append(("Missing values not converted to zero", missing_ok, ""))

    # ── TEST 5: Zero remains zero ─────────────────────────────────────────────
    zero_feat = feature_records[5]   # record_zero
    bpos_cv   = zero_feat["signal_features"].get("block_position", {}).get("current_value")
    flow_cv   = zero_feat["signal_features"].get("flow_rate", {}).get("current_value")
    zero_ok   = bpos_cv == 0.0 and flow_cv == 0.0
    results.append(("Zero values preserved as 0.0", zero_ok,
                     f"bpos={bpos_cv}, flow={flow_cv}" if not zero_ok else ""))

    # ── TEST 6 + 7: No look-ahead leakage ────────────────────────────────────
    # For each record, rolling window features n_obs must not exceed the number
    # of records seen so far in the HISTORY_BUFFER_SECONDS window.
    # A simple heuristic: for the first record, n_obs for any window must be 1.
    first_feat = feature_records[0]
    n_obs_ok = True
    for win_label in ("short", "medium", "long"):
        n_obs = first_feat["signal_features"].get("hookload", {}).get(f"roll_{win_label}_n_obs", -1)
        if n_obs is not None and n_obs > 1:
            n_obs_ok = False
            break
    results.append(("No look-ahead: first record rolling n_obs <= 1", n_obs_ok, ""))

    # ── TEST 8: Source-gap indicator works ────────────────────────────────────
    gap_feat = feature_records[-1]  # record_gap
    sg_flag  = gap_feat["quality_features"].get("source_gap_flag")
    gap_ok   = sg_flag == 1
    results.append(("source_gap_flag = 1 for SOURCE_GAP record", gap_ok,
                     f"got {sg_flag}" if not gap_ok else ""))

    # Also: state features for gap record
    gap_ts_gap = gap_feat["state_features"].get("telemetry_gap")
    results.append(("telemetry_gap state = 1 for SOURCE_GAP record", gap_ts_gap == 1,
                     f"got {gap_ts_gap}" if gap_ts_gap != 1 else ""))

    # ── TEST 9: Depth features unavailable ───────────────────────────────────
    depth_cv_ok = True
    for fr in feature_records:
        depth_sf = fr["signal_features"].get("depth", {})
        if depth_sf.get("current_value") is not None:
            depth_cv_ok = False
            break
    results.append(("Depth current_value is null in all feature records", depth_cv_ok, ""))

    # ── TEST 10: No NaN or Inf in output ─────────────────────────────────────
    nan_issues = []
    for fr in feature_records:
        nan_issues.extend(_no_nan_inf(fr))
    nan_ok = len(nan_issues) == 0
    results.append(("No NaN or Inf in any feature record output", nan_ok,
                     f"{nan_issues[:3]}..." if not nan_ok else ""))

    # ── TEST 11: time_delta_seconds is None for first record ─────────────────
    first_td = feature_records[0]["quality_features"].get("time_delta_seconds")
    results.append(("time_delta_seconds is None for first record", first_td is None,
                     f"got {first_td}" if first_td is not None else ""))

    # ── TEST 12: time_delta correctly calculated ──────────────────────────────
    # records 0 and 1 are 5 seconds apart
    td_r1 = feature_records[1]["quality_features"].get("time_delta_seconds")
    td_ok = td_r1 is not None and abs(td_r1 - 5.0) < 1.0
    results.append(("time_delta_seconds ~5s for adjacent 5-second records", td_ok,
                     f"got {td_r1}" if not td_ok else ""))

    # ── TEST 13: time_gap_flag = 1 for gap record ────────────────────────────
    gap_td_flag = feature_records[-1]["quality_features"].get("time_gap_flag")
    results.append(("time_gap_flag = 1 for record after large gap", gap_td_flag == 1,
                     f"got {gap_td_flag}" if gap_td_flag != 1 else ""))

    # ── TEST 14: rotary_speed_is_zero state correct ───────────────────────────
    zero_rpm_state = feature_records[0]["state_features"].get("rotary_speed_is_zero")
    results.append(("rotary_speed_is_zero = 1 when rpm = 0.0", zero_rpm_state == 1,
                     f"got {zero_rpm_state}" if zero_rpm_state != 1 else ""))

    # ── TEST 15: data_origin preserved ───────────────────────────────────────
    origins_ok = all(r["data_origin"] == "HISTORICAL_SOURCE" for r in feature_records)
    results.append(("data_origin preserved from canonical record", origins_ok, ""))

    # ── Print results ─────────────────────────────────────────────────────────
    print("\n=== NWIS Feature Engine Validation Tests ===\n")
    passed = 0
    failed = 0
    for name, ok, detail in results:
        tag = PASS if ok else FAIL
        msg = f"  {tag} {name}"
        if detail:
            msg += f"\n       Detail: {detail}"
        print(msg)
        if ok:
            passed += 1
        else:
            failed += 1

    print(f"\n  Results: {passed}/{passed+failed} passed.")
    return failed == 0


if __name__ == "__main__":
    ok = run_tests()
    if not ok:
        sys.exit(1)
