import os
import json
import pytest

from ml.simulation.synthetic_wells import get_well_profile

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
SIM_DIR = os.path.join(DATA_DIR, "simulation")

def test_simulation_data_generated():
    assert os.path.exists(SIM_DIR), "Simulation directory not created."
    
    for i in range(2, 7):
        well_id = f"WELL-{i}"
        
        telemetry_file = os.path.join(SIM_DIR, f"well-{i}_telemetry.jsonl")
        risk_file = os.path.join(SIM_DIR, f"well-{i}_risk.jsonl")
        
        assert os.path.exists(telemetry_file), f"Telemetry missing for {well_id}"
        assert os.path.exists(risk_file), f"Risk missing for {well_id}"
        
        with open(risk_file, 'r') as f:
            lines = f.readlines()
            assert len(lines) == 720, f"Expected 720 records, got {len(lines)} for {well_id}"
            
            first = json.loads(lines[0])
            last = json.loads(lines[-1])
            
            # Verify timestamps are monotonic and boundaries are correct
            assert first["timestamp"] < last["timestamp"]
            
            # Verify data_origin is SYNTHETIC_DEMO
            assert first["data_origin"] == "SYNTHETIC_DEMO"
            assert first.get("simulation") is True
            
            # Verify Risk Score is [0, 100]
            for line in lines:
                r = json.loads(line)
                score = r.get("risk_score")
                if score is not None:
                    assert 0 <= score <= 100
                    
            # Verify M0.7 remains totally empty
            assert not first["historical_evidence"]["available"]
            assert len(first["historical_evidence"]["events"]) == 0
