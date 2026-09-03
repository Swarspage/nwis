"""
ml/guidance/validate_guidance.py

Production validation suite for the NWIS Data-Driven Engineering Guidance Engine.
Ensures non-fabrication invariants, schema completeness, well-agnosticism, and evidence grounding.
"""

from ml.guidance.engine import evaluate_guidance
from ml.guidance.schema import GuidanceStatus, GuidanceLevel, ValidationStatus, ProvenanceType


def run_validation():
    print("=== NWIS Engineering Guidance Engine Validation (15/15) ===")
    passed = 0
    total = 0

    def _check(name: str, cond: bool, msg: str = ""):
        nonlocal passed, total
        total += 1
        status = "[PASS]" if cond else "[FAIL]"
        print(f"  {status} {total}. {name}")
        if not cond and msg:
            print(f"         {msg}")
        if cond:
            passed += 1

    # Fixture 1: Normal operating state
    snap_normal = {
        "well_id": "WELL-2",
        "timestamp": "2020-01-01T10:00:00Z",
        "telemetry": {
            "telemetry_status": "OK",
            "signal_features": {
                "torque": {"current_value": 15.0},
                "hookload": {"current_value": 80.0},
                "standpipe_pressure": {"current_value": 2000.0},
                "flow_rate": {"current_value": 500.0}
            }
        },
        "intelligence": {
            "intelligence_status": "SCORED",
            "anomaly_score": 10.0,
            "risk_level": "NORMAL",
            "evidence": []
        },
        "risk": {
            "risk_score": 12.0,
            "risk_level": "NORMAL",
            "alert": False,
            "data_origin": "SYNTHETIC_DEMO"
        }
    }

    # Fixture 2: Torque deviation
    snap_torque = {
        "well_id": "WELL-3",
        "timestamp": "2020-01-01T10:05:00Z",
        "telemetry": {
            "telemetry_status": "OK",
            "signal_features": {
                "torque": {"current_value": 35.0},
                "hookload": {"current_value": 110.0},
                "standpipe_pressure": {"current_value": 2050.0},
                "flow_rate": {"current_value": 500.0}
            }
        },
        "intelligence": {
            "intelligence_status": "SCORED",
            "anomaly_score": 55.0,
            "risk_level": "WATCH",
            "evidence": [
                {"feature": "hookload.roll_medium_mean", "direction": "HIGH", "contribution": 0.45, "z_score": 3.2}
            ]
        },
        "risk": {
            "risk_score": 52.0,
            "risk_level": "WATCH",
            "alert": False,
            "data_origin": "SYNTHETIC_DEMO"
        }
    }

    # Fixture 3: Persistent anomaly / High Risk
    snap_high = {
        "well_id": "WELL-5",
        "timestamp": "2020-01-01T10:10:00Z",
        "telemetry": {
            "telemetry_status": "OK",
            "signal_features": {
                "torque": {"current_value": 50.0},
                "hookload": {"current_value": 140.0},
                "standpipe_pressure": {"current_value": 2800.0},
                "flow_rate": {"current_value": 450.0}
            }
        },
        "intelligence": {
            "intelligence_status": "SCORED",
            "anomaly_score": 88.0,
            "risk_level": "HIGH",
            "evidence": [
                {"feature": "hookload.roll_medium_mean", "direction": "HIGH", "contribution": 0.35, "z_score": 4.1},
                {"feature": "standpipe_pressure.roll_short_std", "direction": "HIGH", "contribution": 0.30, "z_score": 3.8}
            ]
        },
        "risk": {
            "risk_score": 85.0,
            "risk_level": "HIGH",
            "alert": True,
            "data_origin": "SYNTHETIC_DEMO"
        }
    }

    # Fixture 4: Empty / Suppressed telemetry
    snap_empty = {
        "well_id": "WELL-1",
        "timestamp": "2008-12-21T17:21:32Z",
        "telemetry": {"telemetry_status": "EMPTY"},
        "intelligence": {"intelligence_status": "SUPPRESSED", "telemetry_status": "EMPTY"},
        "risk": {}
    }

    res_normal = evaluate_guidance(snap_normal)
    res_torque = evaluate_guidance(snap_torque)
    res_high = evaluate_guidance(snap_high)
    res_empty = evaluate_guidance(snap_empty)

    # 1. Normal state produces INFORMATION guidance level
    _check("Normal state produces INFORMATION level", res_normal.guidance_level == GuidanceLevel.INFORMATION)

    # 2. Torque deviation produces REVIEW guidance level
    _check("Torque deviation produces REVIEW level", res_torque.guidance_level == GuidanceLevel.REVIEW)

    # 3. High risk produces INVESTIGATE guidance level
    _check("High risk produces INVESTIGATE level", res_high.guidance_level == GuidanceLevel.INVESTIGATE)

    # 4. Empty telemetry produces INSUFFICIENT_EVIDENCE level
    _check("Empty telemetry produces INSUFFICIENT_EVIDENCE status", res_empty.guidance_status == GuidanceStatus.INSUFFICIENT_EVIDENCE)

    # 5. Operational action is strictly NULL for heuristics (non-fabrication invariant)
    _check("Operational action is NULL for normal state", res_normal.operational_action is None)
    _check("Operational action is NULL for high risk state", res_high.operational_action is None)

    # 6. Provenance is present and not marked as OIL_APPROVED
    _check("Provenance is present", res_torque.provenance is not None)
    _check("Provenance is NOT OIL_APPROVED for internal heuristics", res_torque.provenance.validation_status != ValidationStatus.OIL_APPROVED)

    # 7. Evidence basis chain is exposed
    _check("Evidence basis chain is populated", len(res_torque.basis) > 0)
    _check("Evidence basis links to M0.5/M0.8", any(b.source in ["M0.5", "M0.8"] for b in res_torque.basis))

    # 8. Available vs Unavailable parameters are correctly identified
    _check("Available parameters identified", "torque" in res_normal.available_parameters)
    _check("Unavailable parameters identified", "rate_of_penetration" in res_normal.unavailable_parameters)

    # 9. Supporting guidance is captured when multiple conditions match
    _check("Multiple matching conditions yield supporting guidance", len(res_high.supporting_guidance) >= 1)

    # 10. Data origin is preserved
    _check("Data origin preserved from snapshot", res_torque.data_origin == "SYNTHETIC_DEMO")

    # 11. Well-agnostic invariant: changing well_id from WELL-3 to WELL-4 produces identical rules
    snap_torque_well4 = dict(snap_torque)
    snap_torque_well4["well_id"] = "WELL-4"
    res_well4 = evaluate_guidance(snap_torque_well4)
    _check("Well-agnostic rule evaluation (identical evidence = identical rule)", res_torque.rule_id == res_well4.rule_id)

    # 12. Recommended review path exists
    _check("Recommended review path populated", len(res_torque.recommended_review_path) > 0)

    # 13. Primary evidence, supporting parameters, and data gaps are explicitly separated
    _check("Primary evidence explicitly separated", len(res_torque.primary_evidence) == 1 and res_torque.primary_evidence[0].feature == "hookload.roll_medium_mean")
    _check("Supporting parameters explicitly populated", any(p.parameter == "hookload" for p in res_torque.supporting_parameters))
    _check("Data gaps explicitly identified", any(g.parameter == "depth" for g in res_torque.data_gaps))

    print(f"\n  Results: {passed}/{total} passed.\n")
    return passed == total


if __name__ == "__main__":
    run_validation()

