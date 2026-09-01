from .data_service import data_service

def get_historical_context(target_ts: str):
    """
    Finds the applicable M0.7 historical context (event interval) for the given timestamp.
    Does not leak future events.
    """
    for kr in data_service.knowledge:
        ctx = kr.get("context", {})
        evt_win = ctx.get("event_window", {})
        if not evt_win:
            continue
            
        start = evt_win.get("start")
        end = evt_win.get("end")
        
        if start and end and (start <= target_ts <= end):
            return kr
            
    return None

def build_snapshot(well_id: str, timestamp: str):
    """
    Assembles a unified frontend snapshot using existing records.
    Never calculates new logic.
    """
    risk_rec = data_service.get_latest_before_or_at(data_service.risk, data_service.risk_ts, timestamp)
    tel_rec = data_service.get_latest_before_or_at(data_service.telemetry, data_service.telemetry_ts, timestamp)
    int_rec = data_service.get_latest_before_or_at(data_service.intelligence, data_service.intelligence_ts, timestamp)
    mod_recs = data_service.get_models_at(timestamp)
    
    # Use exact timestamp if exact match, otherwise use the closest previous timestamp from risk_rec
    effective_ts = risk_rec.get("timestamp") if risk_rec else timestamp
    
    hist_ctx = get_historical_context(effective_ts)
    
    hist_block = {
        "available": hist_ctx is not None,
        "events": [hist_ctx] if hist_ctx else []
    }
    
    prov_block = {
        "data_origin": risk_rec.get("data_origin", "UNKNOWN") if risk_rec else "UNKNOWN"
    }
    
    return {
        "timestamp": effective_ts,
        "well_id": well_id,
        "risk": risk_rec or {},
        "telemetry": tel_rec or {},
        "intelligence": int_rec or {},
        "models": mod_recs,
        "historical_context": hist_block,
        "provenance": prov_block
    }
