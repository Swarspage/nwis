import math
from typing import List, Dict, Any, Optional
from .schema import OffsetRelationship
from .mock_data import get_well_geometry

def calculate_offset_relationships(active_well_id: str, offset_well_ids: List[str], current_depth: Optional[float] = None) -> List[OffsetRelationship]:
    relationships = []
    
    active_geom = get_well_geometry(active_well_id, current_depth)
    
    for offset_id in offset_well_ids:
        offset_geom = get_well_geometry(offset_id, current_depth)
        
        # If either well has unavailable geometry (like WELL-1), return unavailable
        if active_geom.geometry_status == "UNAVAILABLE" or offset_geom.geometry_status == "UNAVAILABLE":
            rel = OffsetRelationship(
                active_well_id=active_well_id,
                offset_well_id=offset_id,
                relevance_status="UNAVAILABLE",
                supported_dimensions=[],
                unavailable_dimensions=["surface_distance", "minimum_3d_separation", "depth_overlap", "trajectory_relationship"],
                data_origin=active_geom.data_origin if active_geom.data_origin != "SYNTHETIC_DEMO" else offset_geom.data_origin,
                provenance="UNAVAILABLE_GEOMETRY"
            )
            relationships.append(rel)
            continue
            
        # Calculate synthetic surface distance
        dx = (active_geom.surface.x or 0) - (offset_geom.surface.x or 0)
        dy = (active_geom.surface.y or 0) - (offset_geom.surface.y or 0)
        surface_distance = math.sqrt(dx*dx + dy*dy)
        
        # Very crude minimum 3D separation
        min_3d = float('inf')
        closest_md = None
        closest_tvd = None
        
        # O(N*M) calculation for synthetic demo
        if active_geom.trajectory and offset_geom.trajectory:
            for p1 in active_geom.trajectory.survey_points:
                for p2 in offset_geom.trajectory.survey_points:
                    dist = math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2)
                    if dist < min_3d:
                        min_3d = dist
                        closest_md = p2.md
                        closest_tvd = p2.tvd
        
        # Depth overlap
        depth_overlap_start = None
        depth_overlap_end = None
        if active_geom.trajectory and offset_geom.trajectory and active_geom.trajectory.survey_points and offset_geom.trajectory.survey_points:
            active_tvds = [p.tvd for p in active_geom.trajectory.survey_points if p.tvd is not None]
            offset_tvds = [p.tvd for p in offset_geom.trajectory.survey_points if p.tvd is not None]
            if active_tvds and offset_tvds:
                ov_start = max(min(active_tvds), min(offset_tvds))
                ov_end = min(max(active_tvds), max(offset_tvds))
                if ov_start <= ov_end:
                    depth_overlap_start = ov_start
                    depth_overlap_end = ov_end

        rel = OffsetRelationship(
            active_well_id=active_well_id,
            offset_well_id=offset_id,
            surface_distance=surface_distance,
            minimum_3d_separation=min_3d,
            closest_approach_md=closest_md,
            closest_approach_tvd=closest_tvd,
            depth_overlap_start=depth_overlap_start,
            depth_overlap_end=depth_overlap_end,
            trajectory_relationship="SYNTHETIC_EVALUATION",
            formation_relationship="UNAVAILABLE",
            historical_relationship="SYNTHETIC_MATCH",
            relevance_status="AVAILABLE",
            supported_dimensions=["surface_distance", "minimum_3d_separation", "trajectory_relationship", "historical_relationship"],
            unavailable_dimensions=["formation_relationship"],
            data_origin="SYNTHETIC_DEMO",
            provenance="SYNTHETIC_RELATIONSHIP_ENGINE"
        )
        relationships.append(rel)
        
    return relationships
