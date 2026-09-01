import json
import uuid
from typing import List, Dict, Any

from .event_schema import HistoricalEvent, KnowledgeRecord
from .event_registry import normalize_event_type, validate_event_type
from .provenance import build_provenance
from .event_alignment import get_event_temporal_bounds
from .telemetry_event_window import partition_evidence, extract_evidence_context

def build_knowledge_records(
    historical_events: List[Dict[str, Any]],
    features: List[Dict[str, Any]],
    intelligence: List[Dict[str, Any]],
    models: List[Dict[str, Any]]
) -> List[KnowledgeRecord]:
    """
    Builds aligned Knowledge Records from Historical Events and analytical evidence.
    """
    knowledge_records = []
    
    for evt_raw in historical_events:
        # Validate event type against taxonomy
        raw_type = evt_raw.get("event_type", "UNKNOWN")
        if not validate_event_type(raw_type):
            raise ValueError(f"Event type {raw_type} is not in the allowed taxonomy. Must map to UNKNOWN or be rejected.")
            
        t_start, t_end = get_event_temporal_bounds(
            evt_raw.get("start_time"), 
            evt_raw.get("end_time")
        )
        
        if not t_start:
            # Cannot align without at least a start time
            continue
            
        # Partition evidence streams
        f_pre, f_evt, f_pst = partition_evidence(features, t_start, t_end)
        i_pre, i_evt, i_pst = partition_evidence(intelligence, t_start, t_end)
        m_pre, m_evt, m_pst = partition_evidence(models, t_start, t_end)
        
        # We store just the event_window for the raw arrays in the record, 
        # or we could store pre/post if requested. 
        # The prompt says: "Do not duplicate entire records unnecessarily."
        # We will keep the event window records directly in the attached evidence.
        
        context = extract_evidence_context(features, t_start, t_end)
        
        knowledge_id = f"KR-{uuid.uuid4()}"
        
        kr: KnowledgeRecord = {
            "knowledge_id": knowledge_id,
            "event": evt_raw, # type: ignore
            "operational_context": None, # M0.7 does not invent operational states for WELL-1
            "context": context,
            "feature_evidence": f_evt,
            "intelligence_evidence": i_evt,
            "model_evidence": m_evt,
            "provenance": build_provenance()
        }
        
        knowledge_records.append(kr)
        
    return knowledge_records

def process_jsonl_file(
    events_path: str,
    features_path: str,
    intelligence_path: str,
    models_path: str,
    output_path: str,
    summary_path: str
):
    """
    End-to-end processing script to load JSONL files and write Knowledge Records.
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
        
    historical_events = _load(events_path)
    features = _load(features_path)
    intelligence = _load(intelligence_path)
    models = _load(models_path)
    
    kr_list = build_knowledge_records(historical_events, features, intelligence, models)
    
    with open(output_path, 'w') as f:
        for kr in kr_list:
            f.write(json.dumps(kr) + "\n")
            
    summary = {
        "well_id": "WELL-1",
        "historical_event_count": len(historical_events),
        "knowledge_record_count": len(kr_list),
        "status": "NO_VERIFIED_HISTORICAL_EVENTS_AVAILABLE" if len(historical_events) == 0 else "SUCCESS",
        "reason": "No authoritative historical event documentation was identified in the available repository data." if len(historical_events) == 0 else ""
    }
    
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
