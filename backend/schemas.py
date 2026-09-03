from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str
    service: str
    api_version: str

class WellInfo(BaseModel):
    well_id: str
    source_system: str
    data_origin: str

class WellsResponse(BaseModel):
    wells: List[WellInfo]
    
class SummaryResponse(BaseModel):
    well_id: str
    m05_intelligence_available: bool
    m06_statistical_models_available: bool
    m07_verified_historical_events_available: int
    supervised_event_labels_available: int
    note: str
    risk_records_generated: int

class TimelineResponse(BaseModel):
    well_id: str
    count: int
    records: List[Dict[str, Any]]

class HistoricalEventsResponse(BaseModel):
    well_id: str
    count: int
    events: List[Dict[str, Any]]
    status: Optional[str] = None

class SnapshotResponse(BaseModel):
    timestamp: str
    well_id: str
    risk: Dict[str, Any]
    telemetry: Dict[str, Any]
    intelligence: Dict[str, Any]
    models: List[Dict[str, Any]]
    historical_context: Dict[str, Any]
    provenance: Dict[str, Any]

class GuidanceResponse(BaseModel):
    well_id: str
    timestamp: Optional[str] = None
    data_origin: str
    guidance_status: str
    guidance_level: str
    title: str
    summary: str
    observations: List[str]
    basis: List[Dict[str, Any]]
    review_parameters: List[str]
    available_parameters: List[str]
    unavailable_parameters: List[str]
    recommended_review_path: List[str]
    operational_action: Optional[str] = None
    limitations: List[str]
    provenance: Dict[str, Any]
    rule_id: str
    supporting_guidance: List[Dict[str, Any]]

