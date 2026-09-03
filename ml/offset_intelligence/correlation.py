"""
ml/offset_intelligence/correlation.py

Historical Depth Correlation Engine for NWIS Offset Intelligence V1.
Maps historical events from relevant offset wells onto active well TVD/MD.
"""

from typing import List, Dict, Any, Optional
from .schemas import HistoricalCorrelation, CurrentWellContext


class HistoricalDepthCorrelationEngine:
    def __init__(self):
        pass

    def correlate_events(
        self,
        current_context: CurrentWellContext,
        historical_events: List[Dict[str, Any]]
    ) -> List[HistoricalCorrelation]:
        """
        Maps historical offset events using TVD alignment.
        Flagged as APPROXIMATE when mapping across wells without geological dip data.
        """
        correlated: List[HistoricalCorrelation] = []

        for raw in historical_events:
            if not isinstance(raw, dict):
                continue

            event_id = raw.get("event_id") or "UNKNOWN_EVENT"
            event_type = raw.get("event_type") or "UNKNOWN_INCIDENT"
            offset_well_id = raw.get("well_id") or "UNKNOWN_WELL"

            md_s = raw.get("md_start") if raw.get("md_start") is not None else raw.get("depth_ft")
            md_e = raw.get("md_end")
            tvd_s = raw.get("tvd_start") if raw.get("tvd_start") is not None else md_s
            tvd_e = raw.get("tvd_end") if raw.get("tvd_end") is not None else md_e

            conf_status = raw.get("confirmation_status") or raw.get("verification_status") or "UNCONFIRMED"
            prov = raw.get("provenance") or "SYNTHETIC_SIMULATION_NON_AUTHORITATIVE"
            origin = raw.get("data_origin") or "SYNTHETIC_DEMO"

            # Determine correlation status
            if tvd_s is not None:
                corr_status = "APPROXIMATE"
                limitation = "Mapped by TVD correspondence; geological dip unverified"
            elif md_s is not None:
                corr_status = "APPROXIMATE"
                limitation = "Mapped by MD; wellbore trajectory deviation unverified"
            else:
                corr_status = "UNAVAILABLE"
                limitation = "No depth coordinates available for historical event"

            correlated.append(
                HistoricalCorrelation(
                    event_id=event_id,
                    event_type=event_type,
                    offset_well_id=offset_well_id,
                    md_start=round(md_s, 1) if md_s is not None else None,
                    md_end=round(md_e, 1) if md_e is not None else None,
                    tvd_start=round(tvd_s, 1) if tvd_s is not None else None,
                    tvd_end=round(tvd_e, 1) if tvd_e is not None else None,
                    confirmation_status=conf_status,
                    correlation_status=corr_status,
                    limitation=limitation,
                    provenance=prov,
                    data_origin=origin
                )
            )

        return correlated
