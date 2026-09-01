from typing import TypedDict, Optional, List, Dict, Any, Union

class EventSource(TypedDict):
    document_id: Optional[str]
    document_name: Optional[str]
    page: Optional[Union[int, str]]
    section: Optional[str]
    original_event_type: Optional[str]
    source_text: Optional[str]
    extraction_method: str

class HistoricalEvent(TypedDict):
    event_id: str
    well_id: str
    event_type: str
    verification_status: str
    conflict_status: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]
    depth_start: Optional[float]
    depth_end: Optional[float]
    data_origin: str
    source: EventSource
    confidence: float
    notes: Optional[str]

class OperationalContext(TypedDict):
    state: str
    source: str
    confidence: Optional[float]

class WindowStats(TypedDict):
    start: Optional[str]
    end: Optional[str]
    record_count: int

class EvidenceContext(TypedDict):
    pre_event: WindowStats
    event_window: WindowStats
    post_event: WindowStats

class Provenance(TypedDict):
    created_at: str
    builder_version: str

class KnowledgeRecord(TypedDict):
    knowledge_id: str
    event: HistoricalEvent
    operational_context: Optional[OperationalContext]
    context: EvidenceContext
    feature_evidence: List[Dict[str, Any]]
    intelligence_evidence: List[Dict[str, Any]]
    model_evidence: List[Dict[str, Any]]
    provenance: Provenance
