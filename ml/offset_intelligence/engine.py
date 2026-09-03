"""
ml/offset_intelligence/engine.py

Master Orchestration Engine for NWIS Offset Intelligence V1.
Coordinates OffsetRelevanceEngine, HistoricalDepthCorrelationEngine, LookAheadEngine,
and OffsetEvidenceContextEngine to produce a unified OffsetIntelligenceResult.
"""

from typing import List, Dict, Any, Optional
from .schemas import (
    OffsetIntelligenceResult,
    CurrentWellContext,
    CurrentBehaviorSummary,
    OffsetsSection,
    HistoricalEvidenceSection,
    LookAhead,
    EvidenceContext
)
from .relevance import OffsetRelevanceEngine
from .correlation import HistoricalDepthCorrelationEngine
from .look_ahead import LookAheadEngine
from .evidence import OffsetEvidenceContextEngine


class OffsetIntelligenceEngine:
    def __init__(self):
        self.relevance_engine = OffsetRelevanceEngine()
        self.correlation_engine = HistoricalDepthCorrelationEngine()
        self.look_ahead_engine = LookAheadEngine()
        self.evidence_engine = OffsetEvidenceContextEngine()

    def evaluate(
        self,
        well_id: str,
        timestamp: Optional[str] = None,
        snapshot: Optional[Dict[str, Any]] = None,
        candidate_well_ids: Optional[List[str]] = None,
        spatial_relationships: Optional[List[Dict[str, Any]]] = None,
        raw_historical_events: Optional[List[Dict[str, Any]]] = None,
        guidance_data: Optional[Dict[str, Any]] = None,
        look_ahead_window_ft: float = 500.0
    ) -> OffsetIntelligenceResult:
        """
        Orchestrates full Offset Intelligence pipeline for a given well state.
        """
        snap = snapshot or {}
        tel = snap.get("telemetry", {})
        intel = snap.get("intelligence", {})
        models = snap.get("models", [])
        risk = snap.get("risk", {})

        # 1. Build Current Well Context
        meas = tel.get("measurements", {}) if isinstance(tel.get("measurements"), dict) else {}
        sim_ctx = tel.get("simulation_context", {}) if isinstance(tel.get("simulation_context"), dict) else {}
        cur_depth = meas.get("depth", {}).get("value") or sim_ctx.get("depth", {}).get("value")
        data_origin = risk.get("data_origin") or intel.get("data_origin") or tel.get("data_origin") or "UNAVAILABLE"

        context = CurrentWellContext(
            well_id=well_id,
            timestamp=timestamp or snap.get("timestamp"),
            current_md=float(cur_depth) if cur_depth is not None else None,
            current_tvd=float(cur_depth) if cur_depth is not None else None,
            replay_status="OK" if snapshot else "NO_SNAPSHOT",
            data_origin=data_origin
        )

        # 2. Extract Current Behavior Summary
        state_feat = tel.get("state_features", {}) if isinstance(tel.get("state_features"), dict) else {}
        mech_regime = state_feat.get("mechanical_regime")
        anom_score = intel.get("anomaly_score")
        
        # Pick top model status if models present
        mod_status = models[0].get("status") if (isinstance(models, list) and len(models) > 0 and isinstance(models[0], dict)) else None

        current_behavior = CurrentBehaviorSummary(
            mechanical_regime=mech_regime,
            anomaly_score=anom_score,
            model_state=mod_status,
            risk=risk
        )

        # 3. Candidate Offset Relevance
        c_ids = candidate_well_ids or ["WELL-1", "WELL-2", "WELL-3", "WELL-4", "WELL-5", "WELL-6"]
        spatial_rels = spatial_relationships or []
        relevance_list = self.relevance_engine.evaluate_relevance(context, c_ids, spatial_rels)

        offsets_section = OffsetsSection(
            candidates=[c.well_id for c in relevance_list],
            relevance=relevance_list
        )

        # 4. Historical Depth Correlation
        raw_events = raw_historical_events or []
        correlated_events = self.correlation_engine.correlate_events(context, raw_events)

        hist_section = HistoricalEvidenceSection(
            events=correlated_events,
            correlation={
                "status": "APPROXIMATE" if correlated_events else "UNAVAILABLE",
                "limitation": "Mapped by TVD alignment; geological dip unverified" if correlated_events else "No historical events available for correlation",
                "total_events": len(correlated_events)
            }
        )

        # 5. Look-Ahead Calculation
        look_ahead = self.look_ahead_engine.compute_look_ahead(
            context,
            correlated_events,
            window_ft=look_ahead_window_ft
        )

        # 6. Evidence Context Layer Assembly
        evidence_context = self.evidence_engine.build_evidence_context(
            context,
            {"risk": risk, "intelligence": intel},
            relevance_list,
            correlated_events,
            look_ahead
        )

        # 7. Final Master Result
        return OffsetIntelligenceResult(
            context=context,
            current_behavior=current_behavior,
            offsets=offsets_section,
            historical_evidence=hist_section,
            look_ahead=look_ahead,
            evidence_context=evidence_context,
            engineering_guidance=guidance_data or {},
            provenance={
                "pipeline_version": "M0.9-V1-CONTEXT",
                "data_origin": data_origin,
                "synthetically_generated": data_origin == "SYNTHETIC_DEMO"
            }
        )
