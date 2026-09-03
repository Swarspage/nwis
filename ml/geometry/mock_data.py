import math
from typing import List, Dict, Any, Optional
from .schema import WellGeometry, SurfaceLocation, WellTrajectory, SurveyPoint, TrajectorySummary

def _calculate_trajectory_summary(trajectory: Optional[WellTrajectory]) -> Optional[TrajectorySummary]:
    if not trajectory or not trajectory.survey_points:
        return None
    pts = trajectory.survey_points
    total_md = pts[-1].md if pts[-1].md is not None else max((p.md for p in pts if p.md is not None), default=0.0)
    max_inc = max((p.inclination for p in pts if p.inclination is not None), default=0.0)
    max_tvd = max((p.tvd for p in pts if p.tvd is not None), default=0.0)
    return TrajectorySummary(
        total_md=total_md,
        max_inclination=max_inc,
        max_tvd=max_tvd
    )

def _generate_synthetic_trajectory(well_id: str, start_depth: float, end_depth: float, shape: str) -> WellTrajectory:
    points = []
    current_md = start_depth
    current_tvd = start_depth
    current_x = 0.0
    current_y = 0.0
    current_z = -start_depth  # Z is down
    
    # We generate a point every 100 ft
    step = 100.0
    
    while current_md <= end_depth:
        # Base straight down
        inclination = 0.0
        azimuth = 0.0
        
        if shape == "build-and-hold" and current_md > 2000:
            # Build up to 30 degrees
            build_rate = min(30.0, (current_md - 2000) / 100.0 * 2.0)
            inclination = build_rate
            azimuth = 45.0
        elif shape == "build-and-turn" and current_md > 3000:
            inclination = min(45.0, (current_md - 3000) / 100.0 * 3.0)
            azimuth = 90.0 + (current_md - 3000) / 100.0 * 1.5
        elif shape == "alternate-directional" and current_md > 4000:
            inclination = min(40.0, (current_md - 4000) / 100.0 * 2.5)
            azimuth = 180.0
        elif shape == "recovery" and current_md > 1500:
            inclination = min(60.0, (current_md - 1500) / 100.0 * 4.0)
            azimuth = 270.0
            
        # Very crude 3D calculation
        inc_rad = math.radians(inclination)
        azi_rad = math.radians(azimuth)
        
        delta_md = step if current_md + step <= end_depth else (end_depth - current_md)
            
        points.append(SurveyPoint(
            md=current_md,
            tvd=current_tvd,
            tvdss=current_tvd,
            inclination=inclination,
            azimuth=azimuth,
            x=current_x,
            y=current_y,
            z=current_z
        ))
        
        if current_md == end_depth:
            break
            
        current_md += delta_md
        current_tvd += delta_md * math.cos(inc_rad)
        current_x += delta_md * math.sin(inc_rad) * math.cos(azi_rad)
        current_y += delta_md * math.sin(inc_rad) * math.sin(azi_rad)
        current_z = -current_tvd

    return WellTrajectory(survey_points=points)

def get_well_geometry(well_id: str, current_sim_depth: Optional[float] = None) -> WellGeometry:
    if well_id == "WELL-1":
        return WellGeometry(
            well_id=well_id,
            well_name="WELL-1 (Historical)",
            well_type="HISTORICAL",
            status="UNAVAILABLE",
            data_origin="HISTORICAL_SOURCE",
            provenance="NWIS_CANONICAL_DATASET",
            geometry_status="UNAVAILABLE",
            surface=None,
            trajectory=None,
            current_md=None,
            current_tvd=None,
            current_tvdss=None
        )
        
    shapes = {
        "WELL-2": "vertical",
        "WELL-3": "build-and-hold",
        "WELL-4": "build-and-turn",
        "WELL-5": "alternate-directional",
        "WELL-6": "recovery"
    }
    
    shape = shapes.get(well_id, "vertical")
    
    # Generate synthetic offsets for surface coordinates
    surface_offsets = {
        "WELL-2": (100.0, 50.0),
        "WELL-3": (-200.0, 150.0),
        "WELL-4": (500.0, -100.0),
        "WELL-5": (0.0, 0.0), # Active well is centered
        "WELL-6": (-300.0, -300.0)
    }
    sx, sy = surface_offsets.get(well_id, (0.0, 0.0))
    
    surface = SurfaceLocation(
        x=sx,
        y=sy,
        elevation=100.0,
        datum="SYNTHETIC_DATUM"
    )
    
    # Usually around 8000 to 9000 ft in the mock data
    max_depth = 10000.0
    trajectory = _generate_synthetic_trajectory(well_id, 0.0, max_depth, shape)
    
    # Adjust X/Y to absolute surface coordinates
    for pt in trajectory.survey_points:
        pt.x += sx
        pt.y += sy
        
    # Calculate current TVD if current_md is provided
    current_tvd = None
    if current_sim_depth is not None:
        for i in range(len(trajectory.survey_points) - 1):
            p1 = trajectory.survey_points[i]
            p2 = trajectory.survey_points[i+1]
            if p1.md <= current_sim_depth <= p2.md:
                ratio = (current_sim_depth - p1.md) / (p2.md - p1.md) if p2.md > p1.md else 0
                current_tvd = p1.tvd + ratio * (p2.tvd - p1.tvd)
                break
        if current_tvd is None and trajectory.survey_points:
            current_tvd = trajectory.survey_points[-1].tvd

    summary = _calculate_trajectory_summary(trajectory)

    return WellGeometry(
        well_id=well_id,
        well_name=f"{well_id} (Synthetic)",
        well_type="SYNTHETIC",
        status="ACTIVE",
        data_origin="SYNTHETIC_DEMO",
        provenance="SYNTHETIC_GENERATOR",
        geometry_status="SYNTHETIC",
        surface=surface,
        trajectory=trajectory,
        summary=summary,
        current_md=current_sim_depth,
        current_tvd=current_tvd,
        current_tvdss=current_tvd
    )
