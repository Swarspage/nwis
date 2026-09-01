from typing import Dict, Any, Optional

def extract_m05_evidence(intel_record: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Extracts M0.5 intelligence contributions safely."""
    if not intel_record:
        return {"available": False}
        
    status = intel_record.get("intelligence_status")
    if status == "SUPPRESSED":
        return {"available": False}
        
    return {
        "available": True,
        "score": intel_record.get("anomaly_score"),
        "level": intel_record.get("risk_level"),
        "confidence": intel_record.get("confidence"),
        "alert": intel_record.get("alert", False),
        "evidence": intel_record.get("evidence", [])
    }

def extract_m06_evidence(model_records: Optional[list]) -> Dict[str, Any]:
    """Extracts M0.6 model contributions safely."""
    if not model_records:
        return {"available": False}
        
    # Find the primary anomaly model (Isolation Forest) as the main M0.6 numerical contributor
    primary_model = None
    for m in model_records:
        if m.get("model_name") == "anomaly_isolation_forest":
            primary_model = m
            break
            
    if not primary_model or primary_model.get("status") != "SUCCESS":
        return {"available": False}
        
    return {
        "available": True,
        "score": primary_model.get("score"),
        "level": primary_model.get("label"),
        "confidence": primary_model.get("confidence"),
        "evidence": primary_model.get("evidence", [])
    }

def extract_m07_evidence(kr_record: Optional[Dict[str, Any]], current_time: str) -> Dict[str, Any]:
    """Extracts M0.7 historical context securely without leakage."""
    if not kr_record:
        return {"available": False}
        
    # Verify the event applies to the current timestamp
    evt = kr_record.get("event", {})
    if not evt:
        return {"available": False}
        
    v_status = evt.get("verification_status")
    
    return {
        "available": True,
        "event_type": evt.get("event_type"),
        "verification_status": v_status,
        "confidence": evt.get("confidence"),
        "source_document": evt.get("source", {}).get("document_name")
    }
