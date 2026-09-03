import pytest
from ml.geometry.schema import WellGeometry, OffsetRelationship, TrajectorySummary
from ml.geometry.mock_data import get_well_geometry, _generate_synthetic_trajectory
from ml.geometry.engine import calculate_offset_relationships
from backend.data_service import data_service

def test_geometry_schema_validation():
    # Valid missing geometry
    geom = WellGeometry(
        well_id="TEST-1",
        data_origin="TEST",
        provenance="TEST",
        geometry_status="UNAVAILABLE"
    )
    assert geom.trajectory is None

def test_missing_geometry_handling():
    geom = get_well_geometry("WELL-1")
    assert geom.geometry_status == "UNAVAILABLE"
    assert geom.trajectory is None
    assert geom.surface is None

def test_synthetic_geometry_generation():
    geom = get_well_geometry("WELL-2")
    assert geom.geometry_status == "SYNTHETIC"
    assert geom.data_origin == "SYNTHETIC_DEMO"
    assert geom.trajectory is not None
    assert len(geom.trajectory.survey_points) > 0

def test_trajectory_calculation():
    traj = _generate_synthetic_trajectory("TEST", 0.0, 1000.0, "vertical")
    assert len(traj.survey_points) == 11 # 0 to 1000 in steps of 100
    for pt in traj.survey_points:
        assert pt.inclination == 0.0
        assert pt.x == 0.0
        assert pt.y == 0.0

def test_offset_relationship_generation():
    rels = calculate_offset_relationships("WELL-2", ["WELL-3", "WELL-1"])
    assert len(rels) == 2
    
    rel_w3 = next(r for r in rels if r.offset_well_id == "WELL-3")
    assert rel_w3.relevance_status == "AVAILABLE"
    assert rel_w3.surface_distance is not None
    assert "formation_relationship" in rel_w3.unavailable_dimensions
    
    rel_w1 = next(r for r in rels if r.offset_well_id == "WELL-1")
    assert rel_w1.relevance_status == "UNAVAILABLE"
    assert "surface_distance" in rel_w1.unavailable_dimensions

def test_surface_distance_vs_minimum_3d_separation():
    rels = calculate_offset_relationships("WELL-5", ["WELL-2"])
    rel = rels[0]
    # Surface distance (wellhead-to-wellhead) vs 3D separation (wellbore-to-wellbore)
    assert rel.surface_distance is not None
    assert rel.minimum_3d_separation is not None
    # They should be distinct concepts
    assert isinstance(rel.surface_distance, float)
    assert isinstance(rel.minimum_3d_separation, float)

def test_closest_approach_md_and_tvd():
    rels = calculate_offset_relationships("WELL-5", ["WELL-3"])
    rel = rels[0]
    assert rel.closest_approach_md is not None
    assert rel.closest_approach_tvd is not None
    assert rel.closest_approach_md >= 0.0
    assert rel.closest_approach_tvd >= 0.0

def test_depth_overlap():
    rels = calculate_offset_relationships("WELL-2", ["WELL-4"])
    rel = rels[0]
    assert rel.depth_overlap_start is not None
    assert rel.depth_overlap_end is not None
    assert rel.depth_overlap_start <= rel.depth_overlap_end

def test_well_1_unavailable_and_no_fake_coords():
    geom = get_well_geometry("WELL-1")
    assert geom.geometry_status == "UNAVAILABLE"
    assert geom.surface is None
    assert geom.trajectory is None
    rels = calculate_offset_relationships("WELL-1", ["WELL-2", "WELL-3"])
    for r in rels:
        assert r.relevance_status == "UNAVAILABLE"
        assert r.surface_distance is None
        assert r.minimum_3d_separation is None

def test_synthetic_provenance_labels():
    geom = get_well_geometry("WELL-3")
    assert geom.data_origin == "SYNTHETIC_DEMO"
    assert geom.provenance == "SYNTHETIC_GENERATOR"
    rels = calculate_offset_relationships("WELL-5", ["WELL-3"])
    assert rels[0].data_origin == "SYNTHETIC_DEMO"

def test_timestamp_aware_geometry():
    geom_no_ts = data_service.get_geometry("WELL-5")
    assert geom_no_ts.current_md is None
    
    # Pass timestamp from simulation telemetry
    ds = data_service.get_dataset("WELL-5", "telemetry")
    if ds and ds[0].get("timestamp"):
        ts = ds[0]["timestamp"]
        geom_ts = data_service.get_geometry("WELL-5", timestamp=ts)
        assert geom_ts.well_id == "WELL-5"

def test_md_vs_tvd_distinction():
    geom = get_well_geometry("WELL-3", current_sim_depth=5000.0)
    # Build-and-hold trajectory: inclination > 0 after 2000ft, so TVD < MD
    assert geom.current_md == 5000.0
    assert geom.current_tvd is not None
    assert geom.current_tvd < geom.current_md

def test_derived_trajectory_summary():
    geom = get_well_geometry("WELL-4")
    assert geom.summary is not None
    assert geom.summary.total_md == 10000.0
    assert geom.summary.max_inclination > 0.0
    assert geom.summary.max_tvd > 0.0

def test_null_elevation_handling():
    geom = get_well_geometry("WELL-2")
    assert geom.surface is not None
    assert geom.surface.elevation is not None
    assert geom.surface.datum == "SYNTHETIC_DATUM"

