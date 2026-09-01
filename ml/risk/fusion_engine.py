from typing import Dict, Any

def fuse_evidence(m05_ev: dict, m06_ev: dict) -> Dict[str, Any]:
    """
    Fuses M0.5 (Deterministic Intelligence) and M0.6 (Statistical ML) into a single risk score.
    M0.7 is excluded from numeric fusion.
    """
    w_05 = 0.45
    w_06 = 0.55
    
    score_05 = m05_ev.get("score") if m05_ev.get("available") else None
    score_06 = m06_ev.get("score") if m06_ev.get("available") else None
    
    # Renormalize weights
    if score_05 is None and score_06 is None:
        return {
            "risk_score": None,
            "fusion_metadata": {
                "configured_weights": {"m05": w_05, "m06": w_06},
                "effective_weights": {"m05": 0.0, "m06": 0.0}
            }
        }
        
    if score_05 is not None and score_06 is None:
        eff_05, eff_06 = 1.0, 0.0
        final = score_05
    elif score_05 is None and score_06 is not None:
        eff_05, eff_06 = 0.0, 1.0
        final = score_06
    else:
        eff_05, eff_06 = w_05, w_06
        final = (score_05 * eff_05) + (score_06 * eff_06)
        
    return {
        "risk_score": max(0.0, min(100.0, float(final))),
        "fusion_metadata": {
            "configured_weights": {"m05": w_05, "m06": w_06},
            "effective_weights": {"m05": eff_05, "m06": eff_06}
        }
    }
