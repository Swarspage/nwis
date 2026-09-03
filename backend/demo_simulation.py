import math
from typing import Dict, Any, List

def _hash_str(s: str) -> int:
    h = 0
    for char in s:
        h = (h * 31 + ord(char)) & 0xFFFFFFFF
    return h

def apply_demo_simulation_pass(data_service):
    """
    Applies a deterministic, cascading simulation pass across loaded datasets.
    Preserves all existing real/non-null values.
    
    Pipeline:
      Telemetry (depth + aliases + features)
        -> Intelligence (anomaly score + evidence)
        -> Models (M0.6 4-model outputs)
        -> Risk Fusion (M0.8 combination)
    """
    # 1. Process WELL-1
    _process_well_telemetry(data_service.telemetry, "WELL-1")
    _process_well_intelligence(data_service.intelligence, data_service.telemetry, "WELL-1")
    _process_well_models(data_service.models, data_service.telemetry, data_service.intelligence, "WELL-1")
    _process_well_risk(data_service.risk, data_service.intelligence, data_service.models, "WELL-1")

    # 2. Process Synthetic Wells (WELL-2 .. WELL-6)
    for well_id, ds in data_service.synthetic.items():
        telemetry = ds.get("telemetry", [])
        intelligence = ds.get("intelligence", [])
        models = ds.get("models", [])
        risk = ds.get("risk", [])

        _process_well_telemetry(telemetry, well_id)
        _process_well_intelligence(intelligence, telemetry, well_id)
        _process_well_models(models, telemetry, intelligence, well_id)
        _process_well_risk(risk, intelligence, models, well_id)
        
        # Add synthetic historical events list if empty
        if "historical_events" not in ds or not ds["historical_events"]:
            ds["historical_events"] = _generate_synthetic_historical_events(well_id)

def _process_well_telemetry(telemetry: List[Dict[str, Any]], well_id: str):
    if not telemetry:
        return
        
    well_seed = _hash_str(well_id) % 1000
    base_depth = 5000.0 + well_seed
    
    alias_map = {
        "rate_of_penetration": "rop",
        "weight_on_bit": "wob",
        "rotary_speed": "rpm"
    }

    for idx, rec in enumerate(telemetry):
        measurements = rec.setdefault("measurements", {})
        
        # 1. Fill missing depth deterministically
        depth_obj = measurements.setdefault("depth", {})
        if depth_obj.get("value") is None:
            sim_ctx = rec.get("simulation_context", {})
            sim_depth = sim_ctx.get("depth", {}).get("value")
            if sim_depth is not None:
                depth_obj["value"] = round(float(sim_depth), 2)
            else:
                depth_obj["value"] = round(base_depth + (idx * 0.45), 2)
            depth_obj["quality"] = "SYNTHETIC"
            depth_obj["unit"] = "ft"

        # 2. Create channel aliases (rop, wob, rpm) if missing so frontend finds them
        for orig_key, alias_key in alias_map.items():
            if orig_key in measurements and alias_key not in measurements:
                orig_item = measurements[orig_key]
                measurements[alias_key] = orig_item

        # 3. Create signal_features alias or build missing telemetry metrics
        torque_val = measurements.get("torque", {}).get("value") or 10.0
        wob_val = measurements.get("wob", {}).get("value") or measurements.get("weight_on_bit", {}).get("value") or 15.0
        rop_val = measurements.get("rop", {}).get("value") or measurements.get("rate_of_penetration", {}).get("value") or 25.0
        spp_val = measurements.get("standpipe_pressure", {}).get("value") or 2500.0

        # 4. Generate derived feature groups if missing
        if "quality_features" not in rec or not rec["quality_features"]:
            rec["quality_features"] = {
                "signal_noise_ratio": 0.96 + (math.sin(idx) * 0.03),
                "missing_data_pct": 0.0,
                "sensor_health_score": 0.99
            }
            
        if "relationship_features" not in rec or not rec["relationship_features"]:
            rec["relationship_features"] = {
                "torque_wob_ratio": round(torque_val / max(wob_val, 1.0), 3),
                "rop_wob_efficiency": round(rop_val / max(wob_val, 1.0), 3),
                "hydraulic_power_index": round((spp_val * 600.0) / 1714.0, 1)
            }
            
        if "state_features" not in rec or not rec["state_features"]:
            rec["state_features"] = {
                "drilling_state": "ROTARY_DRILLING" if rop_val > 5 else "SLIDING",
                "mechanical_regime": "STICK_SLIP_LOW" if torque_val < 15 else "STICK_SLIP_ELEVATED",
                "hydraulic_regime": "NORMAL_FLOW"
            }

def _process_well_intelligence(intelligence: List[Dict[str, Any]], telemetry: List[Dict[str, Any]], well_id: str):
    tel_by_ts = {t.get("timestamp"): t for t in telemetry if t.get("timestamp")}
    
    for idx, rec in enumerate(intelligence):
        ts = rec.get("timestamp")
        tel_rec = tel_by_ts.get(ts)
        
        # Derive anomaly score from telemetry relationship features if score is missing
        if rec.get("anomaly_score") is None:
            if tel_rec:
                rel = tel_rec.get("relationship_features", {})
                t_w_ratio = rel.get("torque_wob_ratio", 0.6)
                # Normal ratio ~ 0.6-0.7, higher means torque anomaly
                calculated_score = min(1.0, max(0.05, (t_w_ratio - 0.4) * 0.8))
                rec["anomaly_score"] = round(calculated_score, 3)
            else:
                rec["anomaly_score"] = round(0.1 + 0.3 * (1.0 + math.sin(idx / 5.0)) / 2.0, 3)
                
        # Populate evidence if missing
        if "evidence" not in rec or not rec["evidence"]:
            score = rec.get("anomaly_score", 0.1)
            if score > 0.4:
                rec["evidence"] = [
                    {
                        "channel": "torque",
                        "description": "Torque fluctuation vs WOB baseline",
                        "severity": round(score, 2),
                        "provenance": "DERIVED_M0.5"
                    }
                ]
            else:
                rec["evidence"] = []

def _process_well_models(models: List[Dict[str, Any]], telemetry: List[Dict[str, Any]], intelligence: List[Dict[str, Any]], well_id: str):
    intel_by_ts = {i.get("timestamp"): i for i in intelligence if i.get("timestamp")}
    
    # 1. Fill null scores on existing models
    for m in models:
        if m.get("score") is None:
            ts = m.get("timestamp")
            intel_rec = intel_by_ts.get(ts, {})
            base_score = intel_rec.get("anomaly_score") or 0.2
            m["score"] = round(base_score * 100.0, 1)
            if not m.get("status") or m.get("status") == "INSUFFICIENT_DATA":
                m["status"] = "SYNTHETIC_EVALUATION"

    # 2. If models list is missing records for timestamps present in telemetry/intelligence, add them
    timestamps = sorted(list(set(
        [t.get("timestamp") for t in telemetry if t.get("timestamp")] +
        [i.get("timestamp") for i in intelligence if i.get("timestamp")]
    )))
    
    existing_ts = set(m.get("timestamp") for m in models if m.get("timestamp"))

    intel_by_ts = {i.get("timestamp"): i for i in intelligence if i.get("timestamp")}
    
    for ts in timestamps:
        if ts in existing_ts:
            continue
            
        intel_rec = intel_by_ts.get(ts, {})
        base_score = intel_rec.get("anomaly_score", 0.15)
        
        # Create 4 synthetic models driven by M0.5 intelligence state
        models.extend([
            {
                "timestamp": ts,
                "well_id": well_id,
                "model_name": "Isolation Forest Anomaly Detector",
                "model_version": "v1.2",
                "score": round(min(1.0, base_score * 1.05), 3),
                "status": "ELEVATED" if base_score > 0.5 else "NORMAL",
                "data_origin": "SYNTHETIC_DEMO"
            },
            {
                "timestamp": ts,
                "well_id": well_id,
                "model_name": "K-Means Behavioral Clustering",
                "model_version": "v2.0",
                "score": round(min(1.0, base_score * 0.9), 3),
                "status": "CLUSTER_2_STABLE" if base_score <= 0.4 else "CLUSTER_4_TRANSITION",
                "data_origin": "SYNTHETIC_DEMO"
            },
            {
                "timestamp": ts,
                "well_id": well_id,
                "model_name": "Temporal Baseline Estimator",
                "model_version": "v0.8",
                "score": round(min(1.0, base_score * 0.85), 3),
                "status": "WITHIN_BOUNDS",
                "data_origin": "SYNTHETIC_DEMO"
            },
            {
                "timestamp": ts,
                "well_id": well_id,
                "model_name": "Prototype RF Event Classifier",
                "model_version": "v1.0",
                "score": round(min(1.0, base_score * 1.1), 3),
                "status": "STICK_SLIP_INDICATOR" if base_score > 0.6 else "NOMINAL",
                "data_origin": "SYNTHETIC_DEMO"
            }
        ])

def _process_well_risk(risk: List[Dict[str, Any]], intelligence: List[Dict[str, Any]], models: List[Dict[str, Any]], well_id: str):
    intel_by_ts = {i.get("timestamp"): i for i in intelligence if i.get("timestamp")}
    models_by_ts = {}
    for m in models:
        ts = m.get("timestamp")
        if ts:
            models_by_ts.setdefault(ts, []).append(m)
            
    for rec in risk:
        # If real risk_score already exists and is non-zero, preserve it and don't overwrite
        has_existing_risk = rec.get("risk_score") is not None
        
        ts = rec.get("timestamp")
        intel_rec = intel_by_ts.get(ts, {})
        m05_raw = intel_rec.get("anomaly_score", 0.15)
        # Normalize m05 score to 0-1 scale if needed
        m05_score = (m05_raw / 100.0) if m05_raw > 1.0 else m05_raw
        
        mod_recs = models_by_ts.get(ts, [])
        if mod_recs:
            m06_scores = []
            for m in mod_recs:
                s = m.get("score")
                if s is not None:
                    # Normalize model scores to 0-100 scale
                    s_norm = s if s > 1.0 else (s * 100.0)
                    m06_scores.append(s_norm)
            m06_score = (sum(m06_scores) / len(m06_scores)) if m06_scores else (m05_score * 100.0)
        else:
            m06_score = m05_score * 100.0
            
        fused_score = round(min(100.0, max(0.0, 0.45 * (m05_score * 100.0) + 0.55 * m06_score)), 1)
        
        if not has_existing_risk:
            rec["risk_score"] = fused_score
            rec["risk_level"] = "NORMAL" if fused_score < 30 else ("ELEVATED" if fused_score < 70 else "HIGH")
        
        if "analytical_evidence" not in rec or not rec["analytical_evidence"]:
            rec["analytical_evidence"] = {
                "m05": {
                    "available": True,
                    "score": round(m05_score * 100.0, 1),
                    "level": "NORMAL" if m05_score < 0.3 else "ELEVATED",
                    "confidence": 0.85,
                    "alert": m05_score > 0.6,
                    "evidence": intel_rec.get("evidence", [])
                },
                "m06": {
                    "available": True,
                    "score": round(m06_score, 1),
                    "level": "NORMAL" if m06_score < 30 else "ELEVATED",
                    "confidence": 0.85,
                    "alert": m06_score > 60,
                    "models": mod_recs
                },
                "fusion_metadata": {
                    "configured_weights": {"m05": 0.45, "m06": 0.55},
                    "effective_weights": {"m05": 0.45, "m06": 0.55}
                }
            }
        else:
            # Update missing m06 block inside existing analytical_evidence if missing
            ae = rec["analytical_evidence"]
            if "m06" not in ae or not ae["m06"].get("available"):
                ae["m06"] = {
                    "available": True,
                    "score": round(m06_score, 1),
                    "level": "NORMAL" if m06_score < 30 else "ELEVATED",
                    "confidence": 0.85,
                    "alert": m06_score > 60,
                    "models": mod_recs
                }
                if "fusion_metadata" not in ae:
                    ae["fusion_metadata"] = {
                        "configured_weights": {"m05": 0.45, "m06": 0.55},
                        "effective_weights": {"m05": 0.45, "m06": 0.55}
                    }
        
        if "prototype_supervised" not in rec:
            rec["prototype_supervised"] = {
                "available": True,
                "prediction": round(rec.get("risk_score", fused_score) / 100.0, 2),
                "status": "ISOLATED_EVALUATION"
            }



def _generate_synthetic_historical_events(well_id: str) -> List[Dict[str, Any]]:
    return [
        {
            "event_id": f"EVT-DEMO-{well_id}-01",
            "well_id": well_id,
            "event_type": "TIGHT_HOLE_INCIDENT",
            "severity": "MODERATE",
            "depth_ft": 5240.0,
            "description": "Simulated tight hole drag during trip out.",
            "data_origin": "SYNTHETIC_DEMO",
            "provenance": "SYNTHETIC_SIMULATION_NON_AUTHORITATIVE"
        },
        {
            "event_id": f"EVT-DEMO-{well_id}-02",
            "well_id": well_id,
            "event_type": "STICK_SLIP_EXCURSION",
            "severity": "HIGH",
            "depth_ft": 6120.5,
            "description": "Simulated severe stick-slip oscillation event.",
            "data_origin": "SYNTHETIC_DEMO",
            "provenance": "SYNTHETIC_SIMULATION_NON_AUTHORITATIVE"
        }
    ]
