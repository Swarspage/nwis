import json
from typing import List, Dict, Any, Optional

from .risk_features import extract_m05_evidence, extract_m06_evidence, extract_m07_evidence
from .risk_model import train_prototype
from .fusion_engine import fuse_evidence
from .alert_engine import generate_alert

def build_lookup_table(records: List[dict], key: str = "timestamp") -> Dict[str, dict]:
    return {r[key]: r for r in records if key in r}

def find_m07_context(knowledge_records: List[dict], timestamp: str) -> Optional[dict]:
    """
    Finds applicable M0.7 historical context (event interval / evidence window) 
    for the current timestamp, ensuring no future M0.7 information leaks.
    """
    if not knowledge_records:
        return None
        
    for kr in knowledge_records:
        ctx = kr.get("context", {})
        evt_win = ctx.get("event_window", {})
        if not evt_win:
            continue
            
        start = evt_win.get("start")
        end = evt_win.get("end")
        
        if start and end and (start <= timestamp <= end):
            return kr
            
    return None

def run_replay(
    features_path: str,
    intel_path: str,
    model_path: str,
    knowledge_path: str,
    output_path: str,
    summary_path: str
):
    """
    Chronological iterator aligning M0.4, M0.5, and M0.6 by timestamp.
    Strict causal loop.
    """
    def _load(p):
        res = []
        try:
            with open(p, 'r') as f:
                for line in f:
                    if line.strip():
                        res.append(json.loads(line))
        except FileNotFoundError:
            pass
        return res
        
    features = _load(features_path)
    intelligence = _load(intel_path)
    models = _load(model_path)
    knowledge = _load(knowledge_path)
    
    # We iterate chronologically based on M0.4 features as the heartbeat
    intel_lkp = build_lookup_table(intelligence)
    
    # Models might have multiple entries per timestamp (one per model), so group them
    model_lkp = {}
    for m in models:
        ts = m.get("timestamp")
        if ts:
            if ts not in model_lkp:
                model_lkp[ts] = []
            model_lkp[ts].append(m)
            
    # Train synthetic prototype
    rf_proto = train_prototype()
    
    risk_records = []
    
    for f_rec in features:
        ts = f_rec.get("timestamp")
        if not ts:
            continue
            
        i_rec = intel_lkp.get(ts)
        m_recs = model_lkp.get(ts, [])
        k_rec = find_m07_context(knowledge, ts)
        
        # Extract evidence
        m05_ev = extract_m05_evidence(i_rec)
        m06_ev = extract_m06_evidence(m_recs)
        m07_ev = extract_m07_evidence(k_rec, ts)
        
        # Fuse numeric risk
        fusion_res = fuse_evidence(m05_ev, m06_ev)
        risk_score = fusion_res.get("risk_score")
        
        # Generate alert and explanation
        alert_res = generate_alert(risk_score, m05_ev, m06_ev, m07_ev)
        
        # Supervised Prototype Prediction
        proto_pred = rf_proto.predict_prototype(f_rec)
        
        risk_record = {
            "timestamp": ts,
            "well_id": f_rec.get("well_id", "WELL-1"),
            "data_origin": f_rec.get("data_origin", "UNKNOWN"),
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
                "available": m07_ev.get("available", False),
                "events": [m07_ev] if m07_ev.get("available") else []
            },
            "prototype_supervised": proto_pred
        }
        
        risk_records.append(risk_record)
        
    with open(output_path, 'w') as f:
        for r in risk_records:
            f.write(json.dumps(r) + "\n")
            
    # Write summary
    summary = {
        "well_id": "WELL-1",
        "m05_intelligence_available": bool(intel_lkp),
        "m06_statistical_models_available": bool(model_lkp),
        "m07_verified_historical_events_available": 0,
        "supervised_event_labels_available": 0,
        "note": "No real supervised event accuracy claimed. Prototype fusion and chronological replay demonstrated.",
        "risk_records_generated": len(risk_records)
    }
    
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
