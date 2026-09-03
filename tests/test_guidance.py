"""
tests/test_guidance.py

Pytest suite for the NWIS Guidance Engine.
"""

import pytest
from ml.guidance.engine import evaluate_guidance
from ml.guidance.schema import GuidanceStatus, GuidanceLevel, ValidationStatus


def test_guidance_normal_state():
    snapshot = {
        "well_id": "WELL-2",
        "timestamp": "2020-01-01T10:00:00Z",
        "telemetry": {
            "telemetry_status": "OK",
            "signal_features": {
                "torque": {"current_value": 15.0},
                "hookload": {"current_value": 80.0}
            }
        },
        "intelligence": {"intelligence_status": "SCORED", "anomaly_score": 10.0, "risk_level": "NORMAL", "evidence": []},
        "risk": {"risk_score": 12.0, "risk_level": "NORMAL", "alert": False, "data_origin": "SYNTHETIC_DEMO"}
    }
    rec = evaluate_guidance(snapshot)
    assert rec.guidance_status == GuidanceStatus.AVAILABLE
    assert rec.guidance_level == GuidanceLevel.INFORMATION
    assert rec.operational_action is None
    assert rec.provenance.validation_status != ValidationStatus.OIL_APPROVED


def test_guidance_torque_deviation():
    snapshot = {
        "well_id": "WELL-3",
        "timestamp": "2020-01-01T10:05:00Z",
        "telemetry": {
            "telemetry_status": "OK",
            "signal_features": {
                "torque": {"current_value": 35.0},
                "hookload": {"current_value": 110.0}
            }
        },
        "intelligence": {
            "intelligence_status": "SCORED",
            "anomaly_score": 55.0,
            "risk_level": "WATCH",
            "evidence": [{"feature": "hookload.roll_medium_mean", "direction": "HIGH", "contribution": 0.45, "z_score": 3.2}]
        },
        "risk": {"risk_score": 52.0, "risk_level": "WATCH", "alert": False, "data_origin": "SYNTHETIC_DEMO"}
    }
    rec = evaluate_guidance(snapshot)
    assert rec.guidance_level == GuidanceLevel.REVIEW
    assert "G-TORQUE-REVIEW-001" in rec.rule_id
    assert len(rec.basis) > 0


def test_guidance_suppressed_telemetry():
    snapshot = {
        "well_id": "WELL-1",
        "timestamp": "2008-12-21T17:21:32Z",
        "telemetry": {"telemetry_status": "EMPTY"},
        "intelligence": {"intelligence_status": "SUPPRESSED"},
        "risk": {}
    }
    rec = evaluate_guidance(snapshot)
    assert rec.guidance_status == GuidanceStatus.INSUFFICIENT_EVIDENCE
    assert rec.guidance_level == GuidanceLevel.INSUFFICIENT_EVIDENCE
    assert rec.operational_action is None


def test_no_well_id_hardcoding():
    snap_a = {
        "well_id": "WELL-2",
        "timestamp": "2020-01-01T10:00:00Z",
        "telemetry": {"telemetry_status": "OK", "signal_features": {"torque": {"current_value": 35.0}}},
        "intelligence": {"intelligence_status": "SCORED", "anomaly_score": 55.0, "evidence": [{"feature": "torque", "contribution": 0.5}]},
        "risk": {"risk_score": 50.0, "data_origin": "SYNTHETIC_DEMO"}
    }
    snap_b = dict(snap_a)
    snap_b["well_id"] = "WELL-5"
    
    rec_a = evaluate_guidance(snap_a)
    rec_b = evaluate_guidance(snap_b)
    
    assert rec_a.rule_id == rec_b.rule_id
    assert rec_a.guidance_level == rec_b.guidance_level
