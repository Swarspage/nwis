from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta

from .event_alignment import get_event_temporal_bounds
from .event_schema import EvidenceContext, WindowStats

def parse_iso(ts: str) -> datetime:
    return datetime.strptime(ts.replace("+00:00", "Z"), "%Y-%m-%dT%H:%M:%SZ")

def partition_evidence(
    records: List[Dict[str, Any]], 
    event_start: str, 
    event_end: str, 
    pre_window_minutes: int = 30,
    post_window_minutes: int = 30
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Partitions a list of telemetry/evidence records into three distinct, non-overlapping windows.
    Strictly enforces:
      PRE_EVENT: start - window <= t < start
      EVENT: start <= t <= end
      POST_EVENT: end < t <= end + post_window
    """
    pre = []
    evt = []
    pst = []
    
    t_start = parse_iso(event_start)
    t_end = parse_iso(event_end)
    t_pre_start = t_start - timedelta(minutes=pre_window_minutes)
    t_post_end = t_end + timedelta(minutes=post_window_minutes)
    
    for rec in records:
        ts_str = rec.get("timestamp")
        if not ts_str:
            continue
        try:
            t = parse_iso(ts_str)
        except Exception:
            continue
            
        if t_pre_start <= t < t_start:
            pre.append(rec)
        elif t_start <= t <= t_end:
            evt.append(rec)
        elif t_end < t <= t_post_end:
            pst.append(rec)
            
    return pre, evt, pst

def _make_stats(records: List[Dict[str, Any]]) -> WindowStats:
    if not records:
        return {"start": None, "end": None, "record_count": 0}
    return {
        "start": records[0]["timestamp"],
        "end": records[-1]["timestamp"],
        "record_count": len(records)
    }

def extract_evidence_context(
    records: List[Dict[str, Any]],
    event_start: str,
    event_end: str
) -> EvidenceContext:
    """
    Given a raw list of records and event bounds, returns the EvidenceContext summary statistics.
    """
    pre, evt, pst = partition_evidence(records, event_start, event_end)
    return {
        "pre_event": _make_stats(pre),
        "event_window": _make_stats(evt),
        "post_event": _make_stats(pst)
    }
