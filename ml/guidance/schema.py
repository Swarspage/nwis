"""
ml/guidance/schema.py

Data schemas for the NWIS Data-Driven Engineering Guidance Engine.
Updated to support strict separation of Primary Evidence, Supporting Parameters, Data Gaps, and Raw-vs-Derived semantics.
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class GuidanceLevel(str, Enum):
    INFORMATION = "INFORMATION"
    MONITOR = "MONITOR"
    REVIEW = "REVIEW"
    INVESTIGATE = "INVESTIGATE"
    ESCALATE = "ESCALATE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class GuidanceStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class ProvenanceType(str, Enum):
    ENGINEERING_RULE = "ENGINEERING_RULE"
    ENGINEERING_HEURISTIC = "ENGINEERING_HEURISTIC"
    ANALYTICAL_GUIDANCE = "ANALYTICAL_GUIDANCE"
    SYSTEM_LIMITATION = "SYSTEM_LIMITATION"


class ValidationStatus(str, Enum):
    NOT_OPERATIONALLY_VALIDATED = "NOT_OPERATIONALLY_VALIDATED"
    SYNTHETIC_DEMO_VALIDATED = "SYNTHETIC_DEMO_VALIDATED"
    OIL_APPROVED = "OIL_APPROVED"


class GuidanceProvenance(BaseModel):
    type: ProvenanceType = ProvenanceType.ENGINEERING_HEURISTIC
    source: str = "NWIS_ANALYTICAL_GUIDANCE"
    validation_status: ValidationStatus = ValidationStatus.NOT_OPERATIONALLY_VALIDATED
    document_reference: Optional[str] = None


class EvidenceBasis(BaseModel):
    source: str  # e.g., "M0.5", "M0.6", "M0.8"
    evidence: str  # e.g., "hookload.roll_medium_mean"
    details: Optional[str] = None
    semantics: str = "DERIVED_ANALYTICAL"  # DERIVED_ANALYTICAL or RAW_TELEMETRY


class PrimaryEvidenceItem(BaseModel):
    feature: str
    source: str
    direction: Optional[str] = None
    z_score: Optional[float] = None
    contribution: Optional[float] = None
    semantics: str = "DERIVED_ANALYTICAL"


class SupportingParameterItem(BaseModel):
    parameter: str
    value: Optional[float] = None
    unit: Optional[str] = None
    status: str = "AVAILABLE"
    semantics: str = "RAW_TELEMETRY"


class DataGapItem(BaseModel):
    parameter: str
    reason: str
    semantics: str = "MISSING_TELEMETRY"


class GuidanceRuleDefinition(BaseModel):
    rule_id: str
    condition: str
    guidance_level: GuidanceLevel
    required_evidence: List[str]
    review_parameters: List[str]
    title: str
    guidance_text: str
    limitation_text: str
    provenance: GuidanceProvenance
    recommended_review_path: List[str] = Field(default_factory=list)


class GuidanceRecord(BaseModel):
    well_id: str
    timestamp: Optional[str] = None
    data_origin: str = "UNAVAILABLE"
    guidance_status: GuidanceStatus = GuidanceStatus.AVAILABLE
    guidance_level: GuidanceLevel = GuidanceLevel.INFORMATION
    title: str
    summary: str
    observations: List[str] = Field(default_factory=list)
    basis: List[EvidenceBasis] = Field(default_factory=list)
    
    # Explicitly separated evidence & telemetry parameter structures
    primary_evidence: List[PrimaryEvidenceItem] = Field(default_factory=list)
    supporting_parameters: List[SupportingParameterItem] = Field(default_factory=list)
    data_gaps: List[DataGapItem] = Field(default_factory=list)
    
    # Flat lists for backwards compatibility and high-level summaries
    review_parameters: List[str] = Field(default_factory=list)
    available_parameters: List[str] = Field(default_factory=list)
    unavailable_parameters: List[str] = Field(default_factory=list)
    
    recommended_review_path: List[str] = Field(default_factory=list)
    operational_action: Optional[str] = None
    limitations: List[str] = Field(default_factory=list)
    provenance: GuidanceProvenance
    rule_id: str
    supporting_guidance: List[Dict[str, Any]] = Field(default_factory=list)
