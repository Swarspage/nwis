"""
ml/offset_intelligence/schemas.py

Pydantic domain contracts for NWIS Offset Intelligence V1.
Defines structured contracts for Current Well Context, Candidate Offset Relevance,
Historical Depth Correlation, Look-Ahead Status, Evidence Context, and Master Result.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class CurrentWellContext(BaseModel):
    well_id: str
    timestamp: Optional[str] = None
    current_md: Optional[float] = None
    current_tvd: Optional[float] = None
    replay_status: str = "OK"
    data_origin: str = "UNAVAILABLE"


class DimensionStatus(BaseModel):
    status: str  # "AVAILABLE", "UNAVAILABLE"
    value: Optional[str] = None
    limitation: Optional[str] = None


class CandidateOffset(BaseModel):
    well_id: str
    overall_relevance: str  # "HIGH", "MODERATE", "LOW", "INSUFFICIENT_EVIDENCE"
    surface_distance_ft: Optional[float] = None
    minimum_sampled_trajectory_separation_ft: Optional[float] = None
    dimensions: Dict[str, DimensionStatus] = Field(default_factory=dict)


class HistoricalCorrelation(BaseModel):
    event_id: str
    event_type: str
    offset_well_id: str
    md_start: Optional[float] = None
    md_end: Optional[float] = None
    tvd_start: Optional[float] = None
    tvd_end: Optional[float] = None
    confirmation_status: str = "UNCONFIRMED"
    correlation_status: str = "APPROXIMATE"  # "VERIFIED", "APPROXIMATE", "UNVERIFIED", "UNAVAILABLE"
    limitation: Optional[str] = "Mapped by TVD alignment; geological dip unverified"
    provenance: str = "SYNTHETIC_SIMULATION_NON_AUTHORITATIVE"
    data_origin: str = "SYNTHETIC_DEMO"


class LookAhead(BaseModel):
    status: str = "UNAVAILABLE"  # "PASSED", "CURRENT", "AHEAD", "UNAVAILABLE"
    tvd_ahead_start_ft: Optional[float] = None
    tvd_ahead_end_ft: Optional[float] = None
    md_ahead_start_ft: Optional[float] = None
    md_ahead_end_ft: Optional[float] = None
    configurable_window_ft: float = 500.0
    target_event_id: Optional[str] = None
    target_offset_well_id: Optional[str] = None


class EvidenceContext(BaseModel):
    summary_text: str
    supporting_evidence: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    confidence: str = "MODERATE"  # "HIGH", "MODERATE", "LOW", "INSUFFICIENT_EVIDENCE"


class CurrentBehaviorSummary(BaseModel):
    mechanical_regime: Optional[str] = None
    anomaly_score: Optional[float] = None
    model_state: Optional[str] = None
    risk: Dict[str, Any] = Field(default_factory=dict)


class OffsetsSection(BaseModel):
    candidates: List[str] = Field(default_factory=list)
    relevance: List[CandidateOffset] = Field(default_factory=list)


class HistoricalEvidenceSection(BaseModel):
    events: List[HistoricalCorrelation] = Field(default_factory=list)
    correlation: Dict[str, Any] = Field(default_factory=dict)


class OffsetIntelligenceResult(BaseModel):
    context: CurrentWellContext
    current_behavior: CurrentBehaviorSummary
    offsets: OffsetsSection
    historical_evidence: HistoricalEvidenceSection
    look_ahead: LookAhead
    evidence_context: EvidenceContext
    engineering_guidance: Dict[str, Any] = Field(default_factory=dict)
    provenance: Dict[str, Any] = Field(default_factory=dict)
