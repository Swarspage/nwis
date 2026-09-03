import json
import os
from datetime import datetime, timezone
import pandas as pd

from .synthetic_wells import SyntheticGenerator, get_well_profile, get_initial_simulated_depth_ft
from ml.features.feature_engine import process_records as process_features
from ml.intelligence.intelligence_engine import process_feature_records as process_intelligence
from ml.models.model_engine import process_feature_records as process_models
from ml.risk.replay_engine import fuse_evidence, generate_alert

def build_fixture_for_well(well_id: str, seed: int, output_dir: str):
    print(f"Generating fixture for {well_id}...")
    profile = get_well_profile(well_id)
    
    # 1 hour at 5 seconds per step = 720 records
    START_TIME = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    generator = SyntheticGenerator(seed=seed, start_time=START_TIME, step_seconds=5)
    generator.simulated_depth = get_initial_simulated_depth_ft(well_id)
    
    telemetry_records = []
    for _ in range(720):
        telemetry_records.append(generator.generate_record(well_id, profile))
        
    # Write Telemetry
    tel_path = os.path.join(output_dir, f"{well_id.lower()}_telemetry.jsonl")
    with open(tel_path, 'w') as f:
        for r in telemetry_records:
            f.write(json.dumps(r) + "\n")
            
    # M0.4 Features (Batch)
    print(f"Running M0.4 for {well_id}...")
    feature_records = list(process_features(telemetry_records))
    
    # M0.5 Intelligence (Batch with baseline 60)
    print(f"Running M0.5 for {well_id}...")
    intel_records = list(process_intelligence(feature_records, baseline_window=60))
    
    # M0.6 Models (Batch)
    print(f"Running M0.6 for {well_id}...")
    model_record_lists = list(process_models(feature_records, warmup_size=15))
    
    # M0.8 Risk Fusion
    print(f"Running M0.8 for {well_id}...")
    risk_records = []
    
    intel_lkp = {r["timestamp"]: r for r in intel_records}
    model_lkp = {}
    for outs in model_record_lists:
        if outs:
            model_lkp[outs[0]["timestamp"]] = outs
            
    for f_rec in feature_records:
        ts = f_rec["timestamp"]
        
        i_rec = intel_lkp.get(ts)
        m_recs = model_lkp.get(ts, [])
        
        # We explicitly isolate prototype models from synthetic risk here.
        # So we only pass the unsupervised M0.6 models if needed, or we mimic M0.8 replay engine.
        from ml.risk.risk_features import extract_m05_evidence, extract_m06_evidence
        
        m05_ev = extract_m05_evidence(i_rec)
        m06_ev = extract_m06_evidence(m_recs)
        
        fusion_res = fuse_evidence(m05_ev, m06_ev)
        risk_score = fusion_res.get("risk_score")
        
        # Ensure M0.7 remains empty for synthetic wells
        m07_ev = {"available": False}
        
        alert_res = generate_alert(risk_score, m05_ev, m06_ev, m07_ev)
        
        risk_record = {
            "timestamp": ts,
            "well_id": well_id,
            "data_origin": "SYNTHETIC_DEMO",
            "simulation": True,
            "risk_score": risk_score,
            "risk_level": alert_res.get("risk_level"),
            "confidence": alert_res.get("confidence"),
            "alert": alert_res.get("alert"),
            "explanation": alert_res.get("explanation"),
            "analytical_evidence": {
                "m05": m05_ev,
                "m06": m06_ev,
                "fusion_metadata": fusion_res.get("fusion_metadata")
            },
            "historical_evidence": {
                "available": False,
                "events": []
            },
            # Dummy prototype_supervised because we isolate Random Forest
            "prototype_supervised": {
                "label": "NORMAL",
                "confidence": 0.5,
                "note": "Not used in risk score"
            }
        }
        risk_records.append(risk_record)
        
    risk_path = os.path.join(output_dir, f"{well_id.lower()}_risk.jsonl")
    with open(risk_path, 'w') as f:
        for r in risk_records:
            f.write(json.dumps(r) + "\n")
            
    intel_path = os.path.join(output_dir, f"{well_id.lower()}_intelligence.jsonl")
    with open(intel_path, 'w') as f:
        for r in intel_records:
            f.write(json.dumps(r) + "\n")
            
    models_path = os.path.join(output_dir, f"{well_id.lower()}_models.jsonl")
    with open(models_path, 'w') as f:
        for outs in model_record_lists:
            for m in outs:
                f.write(json.dumps(m) + "\n")
                
    print(f"Fixture for {well_id} completed.")

if __name__ == "__main__":
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "simulation")
    os.makedirs(output_dir, exist_ok=True)
    
    for i in range(2, 7):
        well_id = f"WELL-{i}"
        build_fixture_for_well(well_id, seed=2000+i, output_dir=output_dir)
