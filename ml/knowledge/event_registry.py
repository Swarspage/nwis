import json
import os
from typing import Dict, Any

def _load_taxonomy() -> Dict[str, Any]:
    path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "metadata", "event_taxonomy.json")
    path = os.path.abspath(path)
    if not os.path.exists(path):
        # Fallback for testing if file is missing
        return {"allowed_event_types": ["UNKNOWN", "STUCK_PIPE", "KICK", "MUD_LOSS", "OTHER"]}
    with open(path, "r") as f:
        return json.load(f)

TAXONOMY = _load_taxonomy()
ALLOWED_EVENTS = set(TAXONOMY.get("allowed_event_types", []))

def normalize_event_type(source_wording: str) -> str:
    """
    Normalizes a source event wording into a canonical taxonomy value.
    If the mapping is ambiguous, returns 'UNKNOWN'.
    """
    if not source_wording:
        return "UNKNOWN"
        
    w = source_wording.lower().strip()
    
    if "stuck" in w or "stk" in w:
        return "STUCK_PIPE"
    if "loss" in w or "lost" in w:
        return "MUD_LOSS"
    if "kick" in w or "influx" in w:
        return "KICK"
    if "torque" in w:
        return "HIGH_TORQUE"
    if "pressure" in w:
        return "PRESSURE_ANOMALY"
    if "rop" in w or "rate of penetration" in w:
        return "ROP_REDUCTION"
    if "washout" in w or "wash out" in w:
        return "WASHOUT"
    if "fish" in w:
        return "FISHING"
    if "control" in w:
        return "WELL_CONTROL"
        
    return "UNKNOWN"

def validate_event_type(event_type: str) -> bool:
    """
    Validates if a given event type is strictly in the allowed taxonomy.
    """
    return event_type in ALLOWED_EVENTS
