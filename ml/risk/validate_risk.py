import json
from jsonschema import validate

from .risk_features import extract_m05_evidence, extract_m06_evidence, extract_m07_evidence
from .risk_model import train_prototype
from .fusion_engine import fuse_evidence
from .alert_engine import generate_alert, evaluate_risk
from .replay_engine import find_m07_context

def run_tests():
    print("=== NWIS M0.8 Validation Tests (20/20) ===")
    
    with open("schemas/nwis_risk_output.schema.json", "r") as f:
        schema_risk = json.load(f)
        
    passed = 0
    total = 0
    
    def _check(name, cond, msg=""):
        nonlocal passed, total
        total += 1
        status = "[PASS]" if cond else "[FAIL]"
        print(f"  {status} {total}. {name}")
        if not cond and msg:
            print(f"         {msg}")
        if cond:
            passed += 1
            
    # Dummy data setup
    m05_valid = {"intelligence_status": "SCORED", "anomaly_score": 85.0, "risk_level": "HIGH", "confidence": 0.9, "alert": True}
    m06_valid = [{"model_name": "anomaly_isolation_forest", "status": "SUCCESS", "score": 90.0, "label": "ANOMALOUS", "confidence": 0.85}]
    m07_kr_valid = {
        "event": {"verification_status": "CONFIRMED", "event_type": "STUCK_PIPE"},
        "context": {"event_window": {"start": "2020-01-01T10:00:00Z", "end": "2020-01-01T11:00:00Z"}}
    }
    
    ev_05 = extract_m05_evidence(m05_valid)
    ev_06 = extract_m06_evidence(m06_valid)
    ev_07 = extract_m07_evidence(m07_kr_valid, "2020-01-01T10:30:00Z")
    
    f_res = fuse_evidence(ev_05, ev_06)
    a_res = generate_alert(f_res["risk_score"], ev_05, ev_06, ev_07)
    
    proto = train_prototype()
    proto_pred = proto.predict_prototype({"hookload.roll_medium_mean": 100.0})
    
    risk_record = {
        "timestamp": "2020-01-01T10:30:00Z",
        "well_id": "WELL-1",
        "data_origin": "HISTORICAL_SOURCE",
        "risk_score": f_res["risk_score"],
        "risk_level": a_res["risk_level"],
        "confidence": a_res["confidence"],
        "alert": a_res["alert"],
        "explanation": a_res["explanation"],
        "analytical_evidence": {
            "m05": ev_05,
            "m06": ev_06,
            "fusion_metadata": f_res["fusion_metadata"]
        },
        "historical_evidence": {
            "available": ev_07.get("available", False),
            "events": [ev_07] if ev_07.get("available") else []
        },
        "prototype_supervised": proto_pred
    }

    # 1 schema compliance
    try: validate(instance=risk_record, schema=schema_risk); ok1 = True
    except Exception as e: ok1 = False; print(e)
    _check("Schema compliance", ok1)
    
    # 2 M0.5 compatibility
    _check("M0.5 compatibility", ev_05["available"] and ev_05["score"] == 85.0)
    
    # 3 M0.6 compatibility
    _check("M0.6 compatibility", ev_06["available"] and ev_06["score"] == 90.0)
    
    # 4 M0.7 compatibility
    _check("M0.7 compatibility", ev_07["available"] and ev_07["event_type"] == "STUCK_PIPE")
    
    # 5 missing M0.5
    f_no_05 = fuse_evidence({"available": False}, ev_06)
    _check("Missing M0.5 handles gracefully", f_no_05["fusion_metadata"]["effective_weights"]["m06"] == 1.0)
    
    # 6 missing M0.6
    f_no_06 = fuse_evidence(ev_05, {"available": False})
    _check("Missing M0.6 handles gracefully", f_no_06["fusion_metadata"]["effective_weights"]["m05"] == 1.0)
    
    # 7 missing M0.7
    a_no_07 = generate_alert(85.0, ev_05, ev_06, {"available": False})
    _check("Missing M0.7 handles gracefully (no physical event mentioned)", "STUCK_PIPE" not in a_no_07["explanation"])
    
    # 8 unavailable model != score zero
    f_none = fuse_evidence({"available": False}, {"available": False})
    _check("Unavailable model != score zero", f_none["risk_score"] is None)
    
    # 9 weight renormalization
    _check("Weight renormalization", f_no_05["risk_score"] == 90.0)
    
    # 10 confidence calculation
    _check("Confidence calculation", a_res["confidence"] == 0.875) # (0.9 + 0.85)/2
    
    # 11 score bounds
    _check("Score bounds (0-100)", 0 <= f_res["risk_score"] <= 100)
    
    # 12 deterministic risk thresholds
    _check("Deterministic risk thresholds", evaluate_risk(80.0) == "HIGH" and evaluate_risk(50.0) == "WATCH")
    
    # 13 no event hallucination
    _check("No event hallucination by M0.5/M0.6", "STUCK_PIPE" not in generate_alert(95.0, ev_05, ev_06, {"available": False})["explanation"])
    
    # 14 synthetic data provenance
    _check("Synthetic data provenance for prototype", proto_pred["data_origin"] == "SYNTHETIC_DEMO")
    
    # 15 WELL-1 not used as supervised event labels
    _check("WELL-1 not used as supervised event labels", proto_pred["used_in_risk_score"] is False)
    
    # 16 NaN/Inf prevention
    _check("NaN/Inf prevention", type(f_res["risk_score"]) == float and not json.dumps(f_res).find("NaN") > -1)
    
    # 17 upstream non-mutation
    _check("Upstream non-mutation", m05_valid["anomaly_score"] == 85.0)
    
    # 18 chronological replay alignment test
    ctx = find_m07_context([m07_kr_valid], "2020-01-01T10:30:00Z")
    _check("Chronological alignment (finds active context)", ctx is not None)
    
    # 19 no look-ahead
    ctx_future = find_m07_context([m07_kr_valid], "2019-12-31T10:30:00Z")
    _check("No look-ahead (ignores future event context)", ctx_future is None)
    
    # 20 deterministic repeated execution
    proto2 = train_prototype()
    p1 = proto.predict_prototype({"hookload.roll_medium_mean": 100.0})
    p2 = proto2.predict_prototype({"hookload.roll_medium_mean": 100.0})
    _check("Deterministic repeated execution", p1 == p2)
    
    print(f"\n  Results: {passed}/{total} passed.\n")
    return passed == total

if __name__ == "__main__":
    run_tests()
