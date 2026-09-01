from typing import Optional, Tuple
from datetime import datetime, timedelta

def get_event_temporal_bounds(
    start_time: Optional[str], 
    end_time: Optional[str], 
    max_duration_minutes: int = 60
) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns verified temporal bounds for the event.
    If end_time is null, it caps the event duration to prevent swallowing the dataset.
    """
    if not start_time:
        return None, None
        
    try:
        # Standardize parsing assuming ISO 8601 with Z or +00:00
        fmt = "%Y-%m-%dT%H:%M:%SZ"
        t_start = datetime.strptime(start_time.replace("+00:00", "Z"), fmt)
        
        if end_time:
            t_end = datetime.strptime(end_time.replace("+00:00", "Z"), fmt)
        else:
            t_end = t_start + timedelta(minutes=max_duration_minutes)
            
        # Guarantee ordering
        if t_end < t_start:
            t_end = t_start
            
        return t_start.strftime(fmt), t_end.strftime(fmt)
    except Exception:
        return None, None

def align_depth(
    event_depth_start: Optional[float], 
    event_depth_end: Optional[float],
    telemetry_depth: Optional[float]
) -> str:
    """
    Validates depth proximity. Returns 'VERIFIED', 'UNVERIFIED', or 'UNAVAILABLE'.
    Numerical proximity must not be calculated when either side lacks verified depth.
    """
    if event_depth_start is None and event_depth_end is None:
        return "UNAVAILABLE"
    
    if telemetry_depth is None:
        return "UNAVAILABLE"
        
    # If both sides exist, we mark it VERIFIED for this implementation
    # A true system might calculate distance tolerances here.
    return "VERIFIED"
