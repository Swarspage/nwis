import pytest
from backend.data_service import data_service
from ml.knowledge.event_alignment import align_depth

def test_01_well1_geometry_remains_unavailable():
    geom = data_service.get_geometry("WELL-1")
    assert geom.geometry_status == "UNAVAILABLE"
    assert geom.surface is None or (geom.surface.x is None and geom.surface.y is None)
    assert geom.trajectory is None or len(geom.trajectory.survey_points) == 0

def test_02_well1_historical_events_zero_when_empty():
    evidence = data_service.get_historical_evidence("WELL-1")
    assert evidence["count"] == 0
    assert evidence["events"] == []
    assert evidence["status"] == "NO_VERIFIED_HISTORICAL_EVENTS_AVAILABLE"

def test_03_no_anomaly_converted_to_historical_event():
    # Anomalies in telemetry/intelligence must not be present in historical evidence
    evidence = data_service.get_historical_evidence("WELL-1")
    # All returned events must originate from verified historical events dataset, not anomaly list
    for evt in evidence["events"]:
        assert evt.get("data_origin") != "DERIVED_M0.5"

def test_04_only_confirmed_events_are_confirmed():
    evidence = data_service.get_historical_evidence("WELL-1")
    for evt in evidence["events"]:
        if evt.get("confirmation_status") != "CONFIRMED":
            assert evt.get("confirmation_status") in ["UNCONFIRMED", "SYNTHETIC", "DEMO_UNVERIFIED"]

def test_05_missing_geometry_prevents_spatial_event_placement():
    geom = data_service.get_geometry("WELL-1")
    assert geom.geometry_status == "UNAVAILABLE"

def test_06_depth_only_event_no_fabricated_xyz():
    # Verify align_depth returns UNAVAILABLE when telemetry or event lacks verified depth
    status = align_depth(None, None, 5000.0)
    assert status == "UNAVAILABLE"

def test_07_synthetic_provenance_labels():
    evidence = data_service.get_historical_evidence("WELL-2")
    assert evidence["well_id"] == "WELL-2"
    for evt in evidence["events"]:
        assert evt["data_origin"] == "SYNTHETIC_DEMO"

def test_08_vlove_provenance_not_oil():
    # Ensure WELL-1 provenance uses VLOVE or HISTORICAL_SOURCE, not OIL field data
    wells_data = data_service.get_historical_evidence("WELL-1")
    for evt in wells_data["events"]:
        assert "OIL" not in evt.get("provenance", "")
