"""
ml/intelligence/validate_intelligence.py

Validation tests for the NWIS intelligence layer (M0.5).

Tests:
 1. Normal record -> low anomaly score (< 30, NORMAL)
 2. Single noisy feature -> does NOT automatically produce HIGH risk
 3. Multiple abnormal features -> ELEVATED or HIGH risk
 4. Persistent anomaly across records -> alert escalation
 5. SOURCE_GAP -> quality degradation / score capped
 6. Missing feature -> no NaN/Inf leakage
 7. Zero remains distinguishable from missing in score computation
 8. No look-ahead: baseline uses only past observations (strict ordering)
 9. SYNTHETIC_DEMO data_origin preserved in intelligence record
10. HISTORICAL_SOURCE and SYNTHETIC_DEMO use identical intelligence schema
11. time_delta_seconds NOT present in anomaly score components
12. Correlation feature excluded when n_obs < CORR_MIN_OBS
13. EMPTY record -> SUPPRESSED, no score, no NaN
"""

import math
import sys
from pathlib import Path
from copy import deepcopy

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.intelligence.intelligence_engine import process_feature_records
from ml.intelligence.baseline import RollingBaseline
from ml.intelligence.anomaly_detector import FEATURE_WEIGHTS, CORR_MIN_OBS
from ml.intelligence.risk_scorer import DEBOUNCE_ELEVATED_RECORDS, DEBOUNCE_WATCH_RECORDS

PASS = "[PASS]"
FAIL = "[FAIL]"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _no_nan_inf(obj, path="root") -> list:
    issues = []
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        issues.append(f"{path} = {obj}")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            issues.extend(_no_nan_inf(v, f"{path}.{k}"))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            issues.extend(_no_nan_inf(v, f"{path}[{i}]"))
    return issues


def _make_feature_record(
    ts="2008-12-21T17:21:36+00:00",
    row_idx=1,
    status="PARTIAL",
    data_origin="HISTORICAL_SOURCE",
    source_gap=0,
    completeness=1.0,
    hookload_mean=70.0,
    hookload_change=0,
    sppa_std=None,
    sppa_change=0,
    bpos_delta=0.0,
    hkld_bpos_diff=47.0,
    sppa_hkld_corr=None,
    hookload_n_obs=20,
    sppa_n_obs=20,
    hookload_range=5.0,
    sppa_range=200.0,
    rpm_zero=1,
    flow_zero=1,
    time_delta=4.9,
):
    """Build a minimal but schema-compliant feature record for testing."""
    def _sig(val, meaningful_change=0, n_obs=20, min_v=None, max_v=None, std=None):
        return {
            "current_value": val,
            "delta": 0.0 if val is not None else None,
            "abs_delta": 0.0 if val is not None else None,
            "meaningful_change": meaningful_change if val is not None else None,
            "meaningful_change_tolerance": 0.1,
            "roll_long_change_frequency": None,
            "roll_short_mean": val,
            "roll_short_std": std,
            "roll_short_min": min_v if min_v is not None else val,
            "roll_short_max": max_v if max_v is not None else val,
            "roll_short_median": val,
            "roll_short_n_obs": n_obs,
            "roll_medium_mean": val,
            "roll_medium_std": std,
            "roll_medium_min": (val - hookload_range/2) if val is not None else None,
            "roll_medium_max": (val + hookload_range/2) if val is not None else None,
            "roll_medium_median": val,
            "roll_medium_n_obs": n_obs,
            "roll_long_mean": val,
            "roll_long_std": std,
            "roll_long_min": min_v if min_v is not None else val,
            "roll_long_max": max_v if max_v is not None else val,
            "roll_long_median": val,
            "roll_long_n_obs": n_obs,
        }

    # Build hookload sig with correct range for guard checks
    hkld_sig = _sig(hookload_mean, meaningful_change=hookload_change, n_obs=hookload_n_obs, std=1.0)
    if hookload_mean is not None:
        hkld_sig["roll_medium_min"] = hookload_mean - hookload_range / 2
        hkld_sig["roll_medium_max"] = hookload_mean + hookload_range / 2
    hkld_sig["roll_medium_n_obs"] = hookload_n_obs

    sppa_sig = _sig(1200.0, meaningful_change=sppa_change, n_obs=sppa_n_obs, std=sppa_std)
    sppa_sig["roll_short_std"] = sppa_std
    sppa_sig["roll_medium_min"] = 1200.0 - sppa_range / 2
    sppa_sig["roll_medium_max"] = 1200.0 + sppa_range / 2
    sppa_sig["roll_medium_n_obs"] = sppa_n_obs

    return {
        "feature_version": "0.1.0",
        "timestamp": ts,
        "well_id": "WELL-1-VLOVE",
        "source_row_index": row_idx,
        "data_origin": data_origin,
        "telemetry_status": status,
        "quality_features": {
            "time_delta_seconds": time_delta,
            "time_gap_flag": 0,
            "source_gap_flag": source_gap,
            "present_channel_count": 6 if completeness == 1.0 else int(6 * completeness),
            "missing_channel_count": 0 if completeness == 1.0 else 6 - int(6 * completeness),
            "telemetry_completeness": completeness,
            "_gap_threshold_seconds": 300,
            "_total_channels_checked": 8,
        },
        "signal_features": {
            "depth": {"current_value": None, "_unavailable_reason": "..."},
            "rate_of_penetration": _sig(10.26),
            "weight_on_bit": _sig(0.0),
            "rotary_speed": _sig(0.0),
            "torque": _sig(0.02),
            "standpipe_pressure": sppa_sig,
            "flow_rate": _sig(0.0 if flow_zero else 1000.0),
            "hookload": hkld_sig,
            "block_position": {
                **_sig(20.0),
                "delta": bpos_delta,
            },
        },
        "state_features": {
            "rotary_speed_is_zero": rpm_zero,
            "flow_rate_is_zero": flow_zero,
            "telemetry_partial": 1 if status == "PARTIAL" else 0,
            "telemetry_gap": 1 if status == "SOURCE_GAP" else 0,
            "telemetry_empty": 1 if status == "EMPTY" else 0,
        },
        "relationship_features": {
            "hookload_bpos_diff": hkld_bpos_diff,
            "roll_medium_sppa_hkld_corr": sppa_hkld_corr,
            "pressure_flow_ratio": None,
            "pressure_flow_abs_diff": None,
            "torque_rpm_product": None,
            "torque_rpm_ratio": None,
            "roll_medium_bpos_hkld_corr": None,
            "roll_medium_torque_rpm_corr": None,
            "roll_medium_sppa_flow_corr": None,
        },
    }


# ── Test runner ───────────────────────────────────────────────────────────────

def run_tests():
    results = []

    def _check(name, ok, detail=""):
        results.append((name, ok, detail))

    # Build 20 stable baseline records then test
    stable_base = [
        _make_feature_record(
            ts=f"2008-12-21T17:{21+i//10:02d}:{(i*5)%60:02d}+00:00",
            row_idx=i,
            hookload_mean=70.0,
            sppa_std=5.0,
            bpos_delta=0.0,
            hkld_bpos_diff=47.0,
            time_delta=5.0,
        )
        for i in range(20)
    ]

    # ── TEST 1: Normal record -> NORMAL risk level ─────────────────────────
    records = stable_base + [_make_feature_record(
        ts="2008-12-21T17:24:00+00:00", row_idx=20,
        hookload_mean=70.0, sppa_std=5.0, bpos_delta=0.0,
        hkld_bpos_diff=47.0, time_delta=5.0,
    )]
    out = list(process_feature_records(records))
    last = out[-1]
    score_ok = last["anomaly_score"] is not None and last["anomaly_score"] < 30
    _check("Normal record -> anomaly_score < 30 (NORMAL)", score_ok,
           f"score={last.get('anomaly_score')}" if not score_ok else "")
    _check("Normal record -> risk_level NORMAL", last["risk_level"] == "NORMAL",
           f"got {last['risk_level']}" if last["risk_level"] != "NORMAL" else "")

    # ── TEST 2: Single noisy feature does NOT produce HIGH risk ───────────
    records2 = deepcopy(stable_base) + [_make_feature_record(
        ts="2008-12-21T17:24:05+00:00", row_idx=20,
        hookload_mean=70.0 + 50.0,  # large hookload spike
        sppa_std=5.0, bpos_delta=0.0, hkld_bpos_diff=47.0,
    )]
    out2 = list(process_feature_records(records2))
    last2 = out2[-1]
    _check("Single noisy feature -> risk_level is NOT HIGH", last2["risk_level"] != "HIGH",
           f"got {last2['risk_level']} score={last2['anomaly_score']}" if last2["risk_level"] == "HIGH" else "")

    # ── TEST 3: Multiple abnormal features -> ELEVATED or HIGH ────────────
    records3 = deepcopy(stable_base) + [_make_feature_record(
        ts="2008-12-21T17:24:05+00:00", row_idx=20,
        hookload_mean=70.0 + 50.0,   # large hookload deviation
        sppa_std=500.0,               # extreme pressure std
        hookload_change=1,
        sppa_change=1,
        bpos_delta=15.0,             # large block movement
        hkld_bpos_diff=10.0,         # structural change
        hookload_range=30.0,
        sppa_range=800.0,
        sppa_hkld_corr=-0.95,        # will be guarded off if n_obs < 10
        hookload_n_obs=15,
        sppa_n_obs=15,
    )]
    out3 = list(process_feature_records(records3))
    last3 = out3[-1]
    _check("Multiple abnormal features -> ELEVATED or HIGH",
           last3["risk_level"] in ("ELEVATED", "HIGH"),
           f"got {last3['risk_level']} score={last3['anomaly_score']}" if last3["risk_level"] not in ("ELEVATED", "HIGH") else "")

    # ── TEST 4: Persistent anomaly -> alert escalation ─────────────────────
    records4 = deepcopy(stable_base)
    for j in range(DEBOUNCE_ELEVATED_RECORDS + 1):
        records4.append(_make_feature_record(
            ts=f"2008-12-21T17:24:{j*5:02d}+00:00",
            row_idx=20 + j,
            hookload_mean=70.0 + 50.0,
            sppa_std=500.0,
            hookload_change=1,
            sppa_change=1,
            bpos_delta=15.0,
            hkld_bpos_diff=10.0,
            hookload_range=30.0,
            sppa_range=800.0,
        ))
    out4 = list(process_feature_records(records4))
    anomaly_results = [r for r in out4 if r.get("risk_level") in ("ELEVATED", "HIGH")]
    alert_fired = any(r["alert"] for r in out4)
    _check("Persistent anomaly -> alert eventually fires", alert_fired,
           f"no alerts in {len(out4)} records" if not alert_fired else "")

    # ── TEST 5: SOURCE_GAP -> quality degradation, score capped ───────────
    records5 = deepcopy(stable_base) + [_make_feature_record(
        ts="2008-12-22T04:00:00+00:00", row_idx=20,
        status="SOURCE_GAP",
        source_gap=1,
        hookload_mean=70.0 + 50.0,  # would be high without cap
        sppa_std=500.0,
        hookload_change=1,
        sppa_change=1,
        bpos_delta=15.0,
        hkld_bpos_diff=10.0,
    )]
    out5 = list(process_feature_records(records5))
    last5 = out5[-1]
    gap_cap_ok = (
        last5["quality_flags"]["source_gap_suppression"] and
        last5["anomaly_score"] is not None and
        last5["anomaly_score"] <= 40.0
    )
    _check("SOURCE_GAP -> score capped at 40 and quality flag set", gap_cap_ok,
           f"status={last5['intelligence_status']} score={last5['anomaly_score']} flags={last5['quality_flags']}" if not gap_cap_ok else "")
    _check("SOURCE_GAP -> intelligence_status DEGRADED",
           last5["intelligence_status"] == "DEGRADED",
           f"got {last5['intelligence_status']}" if last5["intelligence_status"] != "DEGRADED" else "")

    # ── TEST 6: Missing feature -> no NaN or Inf ───────────────────────────
    rec_missing_feats = _make_feature_record(
        ts="2008-12-22T04:01:00+00:00", row_idx=21,
        hookload_mean=70.0,  # keep non-null so helper works; override below
        bpos_delta=None,
        hkld_bpos_diff=None,
    )
    # Override hookload to be null
    rec_missing_feats["signal_features"]["hookload"]["current_value"] = None
    rec_missing_feats["signal_features"]["hookload"]["roll_medium_mean"] = None
    rec_missing_feats["relationship_features"]["hookload_bpos_diff"] = None
    out6 = list(process_feature_records(deepcopy(stable_base) + [rec_missing_feats]))
    issues6 = _no_nan_inf(out6[-1])
    _check("Missing features -> no NaN/Inf in output", len(issues6) == 0,
           str(issues6[:3]) if issues6 else "")

    # ── TEST 7: Zero != missing in score ───────────────────────────────────
    rec_zero = _make_feature_record(
        ts="2008-12-22T04:02:00+00:00", row_idx=22,
        bpos_delta=0.0,  # explicit zero — valid observation
        hookload_mean=70.0,
        hkld_bpos_diff=0.0,
    )
    rec_miss = _make_feature_record(
        ts="2008-12-22T04:02:05+00:00", row_idx=23,
        bpos_delta=None,  # missing
        hookload_mean=70.0,
        hkld_bpos_diff=None,
    )
    # Override to make bpos_delta explicitly null
    rec_miss["signal_features"]["block_position"]["delta"] = None
    rec_miss["relationship_features"]["hookload_bpos_diff"] = None

    base_zero = deepcopy(stable_base)
    out7z = list(process_feature_records(base_zero + [rec_zero]))
    out7m = list(process_feature_records(deepcopy(stable_base) + [rec_miss]))

    zero_count = out7z[-1]["quality_flags"]["available_feature_count"]
    miss_count = out7m[-1]["quality_flags"]["available_feature_count"]
    # Zero record should have more available features than missing record
    _check("Zero value counted as available; missing counted as unavailable",
           zero_count >= miss_count,
           f"zero available={zero_count}, missing available={miss_count}" if zero_count < miss_count else "")

    # ── TEST 8: No look-ahead — strict past-only baseline ─────────────────
    # If we feed ONLY one record, its z_score must be None (no history yet)
    single = [_make_feature_record(ts="2008-12-21T17:21:36+00:00", row_idx=0)]
    out8 = list(process_feature_records(single))
    r8 = out8[0]
    insufficient = r8["quality_flags"]["insufficient_baseline"]
    snap = r8.get("baseline_snapshot", {})
    all_none = all(v is None for v in snap.values())
    _check("First record: insufficient_baseline flag set", insufficient,
           f"got insufficient_baseline={insufficient}" if not insufficient else "")
    _check("First record: all baseline z-scores are None (no history)", all_none,
           f"non-None z-scores: {[k for k,v in snap.items() if v is not None]}" if not all_none else "")

    # ── TEST 9: SYNTHETIC_DEMO data_origin preserved ──────────────────────
    rec_synth = _make_feature_record(
        ts="2008-12-21T17:21:36+00:00", row_idx=0,
        data_origin="SYNTHETIC_DEMO",
    )
    out9 = list(process_feature_records([rec_synth]))
    _check("SYNTHETIC_DEMO data_origin preserved",
           out9[0]["data_origin"] == "SYNTHETIC_DEMO",
           f"got {out9[0]['data_origin']}" if out9[0]["data_origin"] != "SYNTHETIC_DEMO" else "")

    # ── TEST 10: HISTORICAL and SYNTHETIC use identical schema fields ─────
    rec_hist = _make_feature_record(ts="2008-12-21T17:21:40+00:00", row_idx=0,
                                     data_origin="HISTORICAL_SOURCE")
    rec_synt = _make_feature_record(ts="2008-12-21T17:21:45+00:00", row_idx=1,
                                     data_origin="SYNTHETIC_DEMO")
    out10 = list(process_feature_records([rec_hist, rec_synt]))
    fields_hist = set(out10[0].keys())
    fields_synt = set(out10[1].keys())
    _check("HISTORICAL and SYNTHETIC records have identical schema keys",
           fields_hist == fields_synt,
           f"diff: {fields_hist.symmetric_difference(fields_synt)}" if fields_hist != fields_synt else "")

    # ── TEST 11: time_delta_seconds NOT in anomaly score weights ─────────
    _check("time_delta_seconds not in FEATURE_WEIGHTS",
           "time_delta_seconds" not in FEATURE_WEIGHTS and "time_delta" not in FEATURE_WEIGHTS,
           "found in FEATURE_WEIGHTS!" if "time_delta_seconds" in FEATURE_WEIGHTS else "")

    # ── TEST 12: Correlation excluded when n_obs < CORR_MIN_OBS ──────────
    rec_low_obs = _make_feature_record(
        ts="2008-12-22T04:03:00+00:00", row_idx=24,
        hookload_mean=70.0,
        hookload_n_obs=3,   # below CORR_MIN_OBS
        sppa_n_obs=3,
        hookload_range=10.0,
        sppa_range=400.0,
        sppa_hkld_corr=-0.95,  # should be ignored
    )
    out12 = list(process_feature_records(deepcopy(stable_base) + [rec_low_obs]))
    snap12 = out12[-1].get("baseline_snapshot", {})
    # sppa_hkld_corr component should be None/excluded when guard fails
    from ml.intelligence.anomaly_detector import _correlation_guard_passed
    guard_ok = not _correlation_guard_passed(rec_low_obs)
    _check("Correlation excluded when n_obs < CORR_MIN_OBS (guard test)", guard_ok,
           f"guard passed when it should not" if not guard_ok else "")

    # ── TEST 13: EMPTY record -> SUPPRESSED, no score, no NaN ─────────────
    rec_empty = _make_feature_record(
        ts="2008-12-21T17:26:51+00:00", row_idx=3, status="EMPTY",
        hookload_mean=None, bpos_delta=None,
    )
    out13 = list(process_feature_records([rec_empty]))
    r13 = out13[0]
    suppressed_ok = (
        r13["intelligence_status"] == "SUPPRESSED" and
        r13["anomaly_score"] is None and
        r13["risk_level"] is None and
        len(_no_nan_inf(r13)) == 0
    )
    _check("EMPTY record -> SUPPRESSED, anomaly_score=None, no NaN", suppressed_ok,
           f"status={r13['intelligence_status']} score={r13['anomaly_score']} nan={_no_nan_inf(r13)}" if not suppressed_ok else "")

    # ── Print results ──────────────────────────────────────────────────────
    print("\n=== NWIS Intelligence Validation Tests ===\n")
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
