"""
ml/offset_intelligence/evidence.py

Offset Evidence Context Engine for NWIS Offset Intelligence V1.
Builds structured evidence context combining current drilling behavior and historical offset context
without altering numerical M0.8 risk fusion scores.
"""

from typing import List, Dict, Any, Optional
from .schemas import EvidenceContext, CurrentWellContext, LookAhead, HistoricalCorrelation, CandidateOffset


class OffsetEvidenceContextEngine:
    def __init__(self):
        pass

    def build_evidence_context(
        self,
        current_context: CurrentWellContext,
        current_behavior: Dict[str, Any],
        relevant_offsets: List[CandidateOffset],
        correlated_events: List[HistoricalCorrelation],
        look_ahead: LookAhead
    ) -> EvidenceContext:
        """
        Assembles human-readable, structured evidence context without modifying M0.8 risk scores.
        """
        risk_data = current_behavior.get("risk", {})
        risk_level = risk_data.get("risk_level", "NORMAL")
        risk_score = risk_data.get("risk_score")

        supporting_evidence: List[str] = []
        limitations: List[str] = [
            "Cross-well depth correlation is based on approximate TVD alignment; geological formation dip is unverified."
        ]

        if risk_score is not None:
            supporting_evidence.append(f"Current telemetry risk score is {risk_score:.1f} ({risk_level}).")

        high_rel = [o.well_id for o in relevant_offsets if o.overall_relevance in ["HIGH", "MODERATE"]]
        if high_rel:
            supporting_evidence.append(f"Spatially relevant offset wells in view: {', '.join(high_rel)}.")

        # Determine Summary Text & Confidence based on LookAhead state
        if look_ahead.status == "AHEAD" and look_ahead.tvd_ahead_start_ft is not None:
            dist_str = f"{look_ahead.tvd_ahead_start_ft:.0f} ft TVD"
            target_well = look_ahead.target_offset_well_id or "offset well"
            summary_text = (
                f"A comparable historical interval exists approximately {dist_str} ahead in spatially "
                f"relevant offset {target_well}. Current drilling behavior shows {risk_level.lower()} deviation. "
                f"NWIS surfaces the historical case as supporting context for engineering review."
            )
            confidence = "MODERATE"
            supporting_evidence.append(f"Historical incident {look_ahead.target_event_id} mapped approx {dist_str} ahead.")
        elif look_ahead.status == "CURRENT":
            target_well = look_ahead.target_offset_well_id or "offset well"
            summary_text = (
                f"Active bit position is currently within a historical risk interval correlated from "
                f"offset {target_well}. Close monitoring of mechanical telemetry parameters is recommended."
            )
            confidence = "HIGH"
            supporting_evidence.append(f"Bit currently inside historical event interval {look_ahead.target_event_id}.")
        elif look_ahead.status == "PASSED":
            summary_text = "Historical offset risk intervals for closest wells have been passed. No immediate look-ahead hazard detected."
            confidence = "MODERATE"
        else:
            summary_text = "No verified historical offset risk events available within current look-ahead horizon."
            confidence = "INSUFFICIENT_EVIDENCE"
            limitations.append("Historical event database for active area is empty or unconfirmed.")

        return EvidenceContext(
            summary_text=summary_text,
            supporting_evidence=supporting_evidence,
            limitations=limitations,
            confidence=confidence
        )
