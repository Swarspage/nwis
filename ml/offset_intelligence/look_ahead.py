"""
ml/offset_intelligence/look_ahead.py

Look-Ahead Engine for NWIS Offset Intelligence V1.
Calculates deterministic TVD-ahead and MD-ahead distance to upcoming relevant historical intervals.
"""

from typing import List, Dict, Any, Optional
from .schemas import LookAhead, HistoricalCorrelation, CurrentWellContext


class LookAheadEngine:
    def __init__(self, default_window_ft: float = 500.0):
        self.default_window_ft = default_window_ft

    def compute_look_ahead(
        self,
        current_context: CurrentWellContext,
        correlated_events: List[HistoricalCorrelation],
        window_ft: Optional[float] = None
    ) -> LookAhead:
        """
        Determines if a relevant historical interval is PASSED, CURRENT, AHEAD, or UNAVAILABLE.
        Exposes tvd_ahead and md_ahead separately.
        """
        effective_window = window_ft if window_ft is not None else self.default_window_ft
        cur_tvd = current_context.current_tvd
        cur_md = current_context.current_md

        if not correlated_events:
            return LookAhead(
                status="UNAVAILABLE",
                configurable_window_ft=effective_window
            )

        # Filter events with depth info
        valid_events = [e for e in correlated_events if e.tvd_start is not None or e.md_start is not None]
        if not valid_events:
            return LookAhead(
                status="UNAVAILABLE",
                configurable_window_ft=effective_window
            )

        # Evaluate against active well depth (prefer TVD if present, fallback MD)
        best_look_ahead: Optional[LookAhead] = None
        min_ahead_dist = float('inf')

        for event in valid_events:
            evt_tvd_s = event.tvd_start
            evt_tvd_e = event.tvd_end if event.tvd_end is not None else (evt_tvd_s + 50.0 if evt_tvd_s is not None else None)
            evt_md_s = event.md_start
            evt_md_e = event.md_end if event.md_end is not None else (evt_md_s + 50.0 if evt_md_s is not None else None)

            # TVD calculation
            tvd_ahead_s = (evt_tvd_s - cur_tvd) if (cur_tvd is not None and evt_tvd_s is not None) else None
            tvd_ahead_e = (evt_tvd_e - cur_tvd) if (cur_tvd is not None and evt_tvd_e is not None) else None

            # MD calculation
            md_ahead_s = (evt_md_s - cur_md) if (cur_md is not None and evt_md_s is not None) else None
            md_ahead_e = (evt_md_e - cur_md) if (cur_md is not None and evt_md_e is not None) else None

            primary_dist = tvd_ahead_s if tvd_ahead_s is not None else md_ahead_s

            if primary_dist is None:
                continue

            # Determine Status
            if primary_dist < -50.0:
                status = "PASSED"
            elif (cur_tvd is not None and evt_tvd_s is not None and evt_tvd_e is not None and evt_tvd_s <= cur_tvd <= evt_tvd_e) or \
                 (cur_md is not None and evt_md_s is not None and evt_md_e is not None and evt_md_s <= cur_md <= evt_md_e):
                status = "CURRENT"
            elif primary_dist >= 0:
                status = "AHEAD"
            else:
                status = "PASSED"

            # Pick the closest upcoming or current event
            if status in ["AHEAD", "CURRENT"] and primary_dist < min_ahead_dist:
                min_ahead_dist = primary_dist
                best_look_ahead = LookAhead(
                    status=status,
                    tvd_ahead_start_ft=round(tvd_ahead_s, 1) if tvd_ahead_s is not None else None,
                    tvd_ahead_end_ft=round(tvd_ahead_e, 1) if tvd_ahead_e is not None else None,
                    md_ahead_start_ft=round(md_ahead_s, 1) if md_ahead_s is not None else None,
                    md_ahead_end_ft=round(md_ahead_e, 1) if md_ahead_e is not None else None,
                    configurable_window_ft=effective_window,
                    target_event_id=event.event_id,
                    target_offset_well_id=event.offset_well_id
                )

        if best_look_ahead:
            return best_look_ahead

        # Fallback if all events are passed
        first_evt = valid_events[0]
        return LookAhead(
            status="PASSED",
            configurable_window_ft=effective_window,
            target_event_id=first_evt.event_id,
            target_offset_well_id=first_evt.offset_well_id
        )
