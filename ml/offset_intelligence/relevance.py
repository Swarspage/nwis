"""
ml/offset_intelligence/relevance.py

Offset Relevance Engine for NWIS Offset Intelligence V1.
Determines multi-dimensional categorical relevance for candidate offset wells
without fabricating geological data.
"""

from typing import List, Dict, Any, Optional
from .schemas import CandidateOffset, DimensionStatus, CurrentWellContext


class OffsetRelevanceEngine:
    def __init__(self):
        pass

    def evaluate_relevance(
        self,
        current_context: CurrentWellContext,
        candidate_well_ids: List[str],
        spatial_relationships: List[Dict[str, Any]]
    ) -> List[CandidateOffset]:
        """
        Evaluates relevance across spatial, depth, trajectory, and geological dimensions.
        Geological relevance is explicitly marked UNAVAILABLE in V1.
        """
        rel_map = {r.get("offset_well_id"): r for r in spatial_relationships if isinstance(r, dict)}
        candidates: List[CandidateOffset] = []

        for offset_id in candidate_well_ids:
            if offset_id == current_context.well_id:
                continue

            rel_data = rel_map.get(offset_id, {})
            surf_dist = rel_data.get("surface_distance")
            min_3d_sep = rel_data.get("minimum_3d_separation")
            ov_start = rel_data.get("depth_overlap_start")
            ov_end = rel_data.get("depth_overlap_end")
            rel_status = rel_data.get("relevance_status", "UNAVAILABLE")

            dimensions: Dict[str, DimensionStatus] = {}

            # 1. Spatial Dimension
            if surf_dist is not None and min_3d_sep is not None:
                dimensions["spatial"] = DimensionStatus(
                    status="AVAILABLE",
                    value=f"Surface: {surf_dist:.0f} ft | Min Trajectory Sep: {min_3d_sep:.0f} ft"
                )
            elif surf_dist is not None:
                dimensions["spatial"] = DimensionStatus(
                    status="AVAILABLE",
                    value=f"Surface: {surf_dist:.0f} ft"
                )
            else:
                dimensions["spatial"] = DimensionStatus(
                    status="UNAVAILABLE",
                    limitation="No spatial surface coordinates or trajectory geometry available"
                )

            # 2. Depth Overlap Dimension
            if ov_start is not None and ov_end is not None:
                dimensions["depth"] = DimensionStatus(
                    status="AVAILABLE",
                    value=f"Overlap: {ov_start:.0f} - {ov_end:.0f} ft TVD"
                )
            else:
                dimensions["depth"] = DimensionStatus(
                    status="UNAVAILABLE",
                    limitation="No TVD overlap with active well trajectory"
                )

            # 3. Trajectory Relationship Dimension
            traj_rel = rel_data.get("trajectory_relationship")
            if traj_rel and traj_rel != "UNAVAILABLE":
                dimensions["trajectory"] = DimensionStatus(
                    status="AVAILABLE",
                    value=str(traj_rel)
                )
            else:
                dimensions["trajectory"] = DimensionStatus(
                    status="UNAVAILABLE",
                    limitation="Trajectory relationship unverified"
                )

            # 4. Geological Context (EXPLICITLY UNAVAILABLE IN V1)
            dimensions["geological"] = DimensionStatus(
                status="UNAVAILABLE",
                limitation="No formation, lithology, or fault dip data available in V1 architecture"
            )

            # Determine Overall Categorical Relevance
            if rel_status == "UNAVAILABLE":
                overall = "INSUFFICIENT_EVIDENCE"
            elif min_3d_sep is not None and min_3d_sep <= 600.0:
                overall = "HIGH"
            elif min_3d_sep is not None and min_3d_sep <= 2000.0:
                overall = "MODERATE"
            elif surf_dist is not None and surf_dist <= 3000.0:
                overall = "LOW"
            else:
                overall = "INSUFFICIENT_EVIDENCE"

            candidates.append(
                CandidateOffset(
                    well_id=offset_id,
                    overall_relevance=overall,
                    surface_distance_ft=round(surf_dist, 1) if surf_dist is not None else None,
                    minimum_sampled_trajectory_separation_ft=round(min_3d_sep, 1) if min_3d_sep is not None else None,
                    dimensions=dimensions
                )
            )

        return candidates
