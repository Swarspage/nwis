from typing import List, Optional
from pydantic import BaseModel, Field

class SurveyPoint(BaseModel):
    md: Optional[float] = None
    tvd: Optional[float] = None
    tvdss: Optional[float] = None
    inclination: Optional[float] = None
    azimuth: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None

class SurfaceLocation(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    elevation: Optional[float] = None
    datum: Optional[str] = None

class WellTrajectory(BaseModel):
    survey_points: List[SurveyPoint] = Field(default_factory=list)

class TrajectorySummary(BaseModel):
    total_md: Optional[float] = None
    max_inclination: Optional[float] = None
    max_tvd: Optional[float] = None

class WellGeometry(BaseModel):
    well_id: str
    well_name: Optional[str] = None
    well_type: Optional[str] = None
    status: Optional[str] = None
    data_origin: str
    provenance: str
    geometry_status: str  # "AVAILABLE", "SYNTHETIC", "UNAVAILABLE"
    
    surface: Optional[SurfaceLocation] = None
    trajectory: Optional[WellTrajectory] = None
    summary: Optional[TrajectorySummary] = None
    
    current_md: Optional[float] = None
    current_tvd: Optional[float] = None
    current_tvdss: Optional[float] = None

class OffsetRelationship(BaseModel):
    active_well_id: str
    offset_well_id: str
    
    surface_distance: Optional[float] = None
    minimum_3d_separation: Optional[float] = None
    closest_approach_md: Optional[float] = None
    closest_approach_tvd: Optional[float] = None
    
    depth_overlap_start: Optional[float] = None
    depth_overlap_end: Optional[float] = None
    
    trajectory_relationship: Optional[str] = None
    formation_relationship: Optional[str] = None
    historical_relationship: Optional[str] = None
    
    relevance_status: str
    supported_dimensions: List[str] = Field(default_factory=list)
    unavailable_dimensions: List[str] = Field(default_factory=list)
    
    data_origin: str
    provenance: str
