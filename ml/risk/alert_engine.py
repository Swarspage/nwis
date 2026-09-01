from typing import Dict, Any

def evaluate_risk(score: float) -> str:
    if score >= 80:
        return "HIGH"
    if score >= 60:
        return "ELEVATED"
    if score >= 30:
        return "WATCH"
    return "NORMAL"

def generate_alert(
    risk_score: float, 
    m05_ev: dict, 
    m06_ev: dict, 
    m07_ev: dict
) -> Dict[str, Any]:
    """
    Generates the final frontend risk block.
    Strictly enforces the rule: M0.5/M0.6 outputs must never generate physical-event names.
    Physical event terminology may only be displayed when supplied by an explicitly 
    CONFIRMED M0.7 historical record.
    """
    if risk_score is None:
        return {
            "risk_level": None,
            "confidence": None,
            "alert": False,
            "explanation": "Insufficient analytical evidence to compute risk."
        }
        
    risk_level = evaluate_risk(risk_score)
    
    # Calculate unified confidence
    conf_05 = m05_ev.get("confidence", 0.0)
    conf_06 = m06_ev.get("confidence", 0.0)
    
    available = sum([1 for e in [m05_ev, m06_ev] if e.get("available")])
    confidence = (conf_05 + conf_06) / available if available > 0 else 0.0
    
    # Alert boolean: simple threshold for prototype
    alert = (risk_score >= 80)
    
    # Explanations
    explanation = "Analytical evidence indicates normal behavior."
    
    if risk_level in ["ELEVATED", "HIGH"]:
        explanation = f"Analytical evidence indicates {risk_level} statistical deviation."
        
    if m07_ev.get("available") and m07_ev.get("verification_status") == "CONFIRMED":
        evt_type = m07_ev.get("event_type", "UNKNOWN")
        explanation += f" Historical evidence confirms a {evt_type} event occurred in this window."
        
    return {
        "risk_level": risk_level,
        "confidence": round(confidence, 4),
        "alert": alert,
        "explanation": explanation
    }
