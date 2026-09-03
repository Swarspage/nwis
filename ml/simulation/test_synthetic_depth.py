import os
import json
import pytest
from backend.app import app
from fastapi.testclient import TestClient

client = TestClient(app)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
SIM_DIR = os.path.join(DATA_DIR, "simulation")

def test_synthetic_depth_presence_and_monotonicity():
    for i in range(2, 7):
        well_id = f"WELL-{i}"
        tel_file = os.path.join(SIM_DIR, f"well-{i}_telemetry.jsonl")
        assert os.path.exists(tel_file)
        
        with open(tel_file, 'r') as f:
            lines = f.readlines()
            
        prev_depth = None
        for line in lines:
            r = json.loads(line)
            
            # 1. Canonical depth MUST be null
            assert r["measurements"]["depth"]["value"] is None
            
            # 2. Simulation context must exist with SYNTHETIC_SIMULATION semantics
            sim_ctx = r.get("simulation_context")
            assert sim_ctx is not None, f"simulation_context missing in {well_id}"
            
            sim_depth = sim_ctx["depth"]
            assert sim_depth["semantics"] == "SYNTHETIC_SIMULATION"
            assert sim_depth["unit"] == "ft"
            assert sim_depth["source"] == "synthetic_rop_progression"
            
            val = sim_depth["value"]
            assert val is not None
            
            # 3. Monotonicity
            if prev_depth is not None:
                assert val >= prev_depth, f"Depth not monotonic in {well_id}: {val} < {prev_depth}"
                
                # 4. ROP consistency
                rop = r["measurements"]["rate_of_penetration"]["value"]
                expected_delta = (rop / 3600.0) * 5
                actual_delta = val - prev_depth
                assert abs(actual_delta - expected_delta) < 0.001
                
            prev_depth = val

def test_well_1_isolation():
    # WELL-1 must not have simulation_context in its historical data
    well1_tel_file = os.path.join(DATA_DIR, "processed", "well1_feature_sample.jsonl")
    assert os.path.exists(well1_tel_file)
    with open(well1_tel_file, 'r') as f:
        r = json.loads(f.readline())
        assert "simulation_context" not in r

def test_simulation_control_and_api():
    # Start the simulation
    client.post("/api/v1/simulation/control", json={"action": "start"})
    
    # Check that the API exposes the simulation context without changing measurements
    resp = client.get("/api/v1/wells/WELL-2/snapshot?timestamp=2026-01-01T00:05:00Z")
    assert resp.status_code == 200
    data = resp.json()
    
    tel = data["telemetry"]
    assert "simulation_context" in tel
    assert tel["simulation_context"]["depth"]["semantics"] == "SYNTHETIC_SIMULATION"
    assert tel["measurements"]["depth"]["value"] is None
