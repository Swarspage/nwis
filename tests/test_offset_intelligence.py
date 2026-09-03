"""
tests/test_offset_intelligence.py

Comprehensive unit and API test suite for NWIS Offset Intelligence V1.
Tests domain schemas, OffsetRelevanceEngine, HistoricalDepthCorrelationEngine,
LookAheadEngine, OffsetEvidenceContextEngine, and the GET /api/v1/wells/{well_id}/offset-intelligence API endpoint.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app import app
from ml.offset_intelligence import (
    CurrentWellContext,
    OffsetRelevanceEngine,
    HistoricalDepthCorrelationEngine,
    LookAheadEngine,
    OffsetEvidenceContextEngine,
    OffsetIntelligenceEngine,
    OffsetIntelligenceResult
)

client = TestClient(app)


def test_domain_schemas_instantiation():
    ctx = CurrentWellContext(
        well_id="WELL-5",
        current_md=7900.0,
        current_tvd=7850.0,
        data_origin="SYNTHETIC_DEMO"
    )
    assert ctx.well_id == "WELL-5"
    assert ctx.current_md == 7900.0


def test_offset_relevance_engine():
    engine = OffsetRelevanceEngine()
    ctx = CurrentWellContext(well_id="WELL-5", current_tvd=7850.0)
    spatial_rels = [
        {
            "offset_well_id": "WELL-3",
            "surface_distance": 250.0,
            "minimum_3d_separation": 180.0,
            "depth_overlap_start": 5000.0,
            "depth_overlap_end": 9000.0,
            "trajectory_relationship": "SYNTHETIC_EVALUATION",
            "relevance_status": "AVAILABLE"
        }
    ]

    candidates = engine.evaluate_relevance(ctx, ["WELL-3"], spatial_rels)
    assert len(candidates) == 1
    cand = candidates[0]
    assert cand.well_id == "WELL-3"
    assert cand.overall_relevance == "HIGH"
    assert cand.dimensions["geological"].status == "UNAVAILABLE"
    assert "No formation" in cand.dimensions["geological"].limitation


def test_historical_correlation_engine():
    engine = HistoricalDepthCorrelationEngine()
    ctx = CurrentWellContext(well_id="WELL-5", current_tvd=7850.0)
    raw_events = [
        {
            "event_id": "EVT-TEST-01",
            "well_id": "WELL-3",
            "event_type": "STICK_SLIP_EXCURSION",
            "tvd_start": 8000.0,
            "tvd_end": 8050.0,
            "confirmation_status": "CONFIRMED",
            "provenance": "SYNTHETIC_SIMULATION_NON_AUTHORITATIVE",
            "data_origin": "SYNTHETIC_DEMO"
        }
    ]

    correlated = engine.correlate_events(ctx, raw_events)
    assert len(correlated) == 1
    evt = correlated[0]
    assert evt.event_id == "EVT-TEST-01"
    assert evt.correlation_status == "APPROXIMATE"
    assert evt.tvd_start == 8000.0


def test_look_ahead_engine_ahead_status():
    engine = LookAheadEngine(default_window_ft=500.0)
    ctx = CurrentWellContext(well_id="WELL-5", current_md=7900.0, current_tvd=7850.0)

    from ml.offset_intelligence.schemas import HistoricalCorrelation
    events = [
        HistoricalCorrelation(
            event_id="EVT-01",
            event_type="STICK_SLIP",
            offset_well_id="WELL-3",
            tvd_start=8000.0,
            tvd_end=8050.0,
            md_start=8050.0,
            md_end=8100.0,
            correlation_status="APPROXIMATE"
        )
    ]

    look_ahead = engine.compute_look_ahead(ctx, events, window_ft=500.0)
    assert look_ahead.status == "AHEAD"
    assert look_ahead.tvd_ahead_start_ft == 150.0
    assert look_ahead.md_ahead_start_ft == 150.0
    assert look_ahead.target_event_id == "EVT-01"


def test_evidence_context_engine():
    engine = OffsetEvidenceContextEngine()
    ctx = CurrentWellContext(well_id="WELL-5", current_tvd=7850.0)
    from ml.offset_intelligence.schemas import LookAhead
    la = LookAhead(
        status="AHEAD",
        tvd_ahead_start_ft=150.0,
        target_event_id="EVT-01",
        target_offset_well_id="WELL-3"
    )

    ev_ctx = engine.build_evidence_context(ctx, {"risk": {"risk_level": "ELEVATED", "risk_score": 65.0}}, [], [], la)
    assert "150 ft TVD" in ev_ctx.summary_text
    assert "WELL-3" in ev_ctx.summary_text
    assert ev_ctx.confidence == "MODERATE"


def test_api_offset_intelligence_endpoint():
    res = client.get("/api/v1/wells/WELL-5/offset-intelligence")
    assert res.status_code == 200
    data = res.json()
    assert "context" in data
    assert "offsets" in data
    assert "look_ahead" in data
    assert "evidence_context" in data
    assert data["provenance"]["pipeline_version"] == "M0.9-V1-CONTEXT"


def test_api_well_1_empty_historical_events_unavailability():
    res = client.get("/api/v1/wells/WELL-1/offset-intelligence")
    assert res.status_code == 200
    data = res.json()
    assert data["context"]["well_id"] == "WELL-1"
    assert data["historical_evidence"]["correlation"]["status"] in ["APPROXIMATE", "UNAVAILABLE"]

def test_empty_events_engine_behavior():
    engine = OffsetIntelligenceEngine()
    ctx_res = engine.evaluate(well_id="WELL-1", snapshot={}, candidate_well_ids=["WELL-2"], raw_historical_events=[])
    assert ctx_res.evidence_context.confidence == "INSUFFICIENT_EVIDENCE"

