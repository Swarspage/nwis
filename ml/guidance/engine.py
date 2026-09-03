"""
ml/guidance/engine.py

Core decision-support guidance engine for NWIS.
Consumes M0.4–M0.8 state snapshot and evaluates data-driven engineering rules.
Ensures strict data correctness, raw-vs-derived semantics, and separation of Primary Evidence,
Supporting Parameters, and Data Gaps.
"""

from typing import Dict, Any, List, Optional
from .schema import (
    GuidanceRecord, GuidanceStatus, GuidanceLevel, EvidenceBasis,
    GuidanceProvenance, ProvenanceType, ValidationStatus,
    PrimaryEvidenceItem, SupportingParameterItem, DataGapItem
)
from .registry import registry
from .provenance import build_heuristic_provenance, build_limitation_provenance

# Standard telemetry channels evaluated for availability
STANDARD_CHANNELS = [
    "torque",
    "hookload",
    "standpipe_pressure",
    "flow_rate",
    "rotary_speed",
    "rate_of_penetration",
    "block_position",
    "weight_on_bit",
    "depth"
]


def _extract_telemetry_parameters(telemetry: Optional[Dict[str, Any]]) -> tuple[List[SupportingParameterItem], List[DataGapItem], List[str], List[str]]:
    """
    Extracts raw telemetry parameter states from snapshot.
    Supports canonical measurement records, M0.4 feature records, and flat telemetry objects.
    """
    supporting_params: List[SupportingParameterItem] = []
    data_gaps: List[DataGapItem] = []
    available_params: List[str] = []
    unavailable_params: List[str] = []

    if not telemetry:
        for ch in STANDARD_CHANNELS:
            unavailable_params.append(ch)
            data_gaps.append(DataGapItem(parameter=ch, reason="Telemetry snapshot unavailable", semantics="MISSING_TELEMETRY"))
        return supporting_params, data_gaps, available_params, unavailable_params

    meas = telemetry.get("measurements", {})
    sig = telemetry.get("signal_features", {})

    for ch in STANDARD_CHANNELS:
        val = None
        unit = None
        quality = None

        # 1. Check canonical measurements object
        if ch in meas and isinstance(meas[ch], dict):
            val = meas[ch].get("value")
            unit = meas[ch].get("unit")
            quality = meas[ch].get("quality")
        # 2. Check signal_features object
        elif ch in sig and isinstance(sig[ch], dict):
            val = sig[ch].get("current_value")
            if "_unavailable_reason" in sig[ch]:
                quality = "MISSING"
        # 3. Check flat telemetry object
        elif ch in telemetry:
            if isinstance(telemetry[ch], dict):
                val = telemetry[ch].get("value")
            else:
                val = telemetry[ch]

        if val is not None and quality != "MISSING":
            try:
                val_float = round(float(val), 4)
            except (ValueError, TypeError):
                val_float = None

            if val_float is not None:
                available_params.append(ch)
                supporting_params.append(
                    SupportingParameterItem(
                        parameter=ch,
                        value=val_float,
                        unit=unit,
                        status="AVAILABLE",
                        semantics="RAW_TELEMETRY"
                    )
                )
                continue

        # If value is null or quality is MISSING
        reason = "No verified channel in telemetry feed" if ch == "depth" else "Sensor unread or missing at timestamp"
        unavailable_params.append(ch)
        data_gaps.append(
            DataGapItem(
                parameter=ch,
                reason=reason,
                semantics="MISSING_TELEMETRY"
            )
        )

    return supporting_params, data_gaps, available_params, unavailable_params


def evaluate_guidance(snapshot: Dict[str, Any]) -> GuidanceRecord:
    """
    Evaluates evidence from a structured timestamped snapshot containing:
      - well_id
      - timestamp
      - telemetry
      - intelligence (M0.5)
      - models (M0.6)
      - risk (M0.8)
    
    Returns a structured, evidence-grounded GuidanceRecord.
    """
    well_id = snapshot.get("well_id", "UNKNOWN")
    timestamp = snapshot.get("timestamp")
    
    risk_rec = snapshot.get("risk") or {}
    intel_rec = snapshot.get("intelligence") or {}
    models_rec = snapshot.get("models") or []
    telemetry_rec = snapshot.get("telemetry") or {}
    
    data_origin = risk_rec.get("data_origin") or intel_rec.get("data_origin") or telemetry_rec.get("data_origin") or "UNAVAILABLE"
    
    supporting_params, data_gaps, available_params, unavailable_params = _extract_telemetry_parameters(telemetry_rec)
    
    # Quality gate / Suppressed check
    intel_status = intel_rec.get("intelligence_status")
    telemetry_status = intel_rec.get("telemetry_status") or telemetry_rec.get("telemetry_status")
    
    if intel_status == "SUPPRESSED" or telemetry_status == "EMPTY" or not risk_rec:
        rule = registry.get("G-INSUFFICIENT-EVIDENCE-006")
        return GuidanceRecord(
            well_id=well_id,
            timestamp=timestamp,
            data_origin=data_origin,
            guidance_status=GuidanceStatus.INSUFFICIENT_EVIDENCE,
            guidance_level=GuidanceLevel.INSUFFICIENT_EVIDENCE,
            title=rule.title,
            summary=rule.guidance_text,
            observations=["Telemetry status is EMPTY or suppressed. Insufficient analytical evidence to evaluate guidance."],
            basis=[EvidenceBasis(source="QUALITY_GATE", evidence="suppressed_or_empty_telemetry", details=f"status: {telemetry_status}", semantics="DERIVED_ANALYTICAL")],
            primary_evidence=[],
            supporting_parameters=supporting_params,
            data_gaps=data_gaps,
            review_parameters=[],
            available_parameters=available_params,
            unavailable_parameters=unavailable_params,
            recommended_review_path=rule.recommended_review_path,
            operational_action=None,
            limitations=[rule.limitation_text],
            provenance=build_limitation_provenance("SUPPRESSED_TELEMETRY"),
            rule_id=rule.rule_id,
            supporting_guidance=[]
        )
        
    risk_score = risk_rec.get("risk_score")
    risk_level = risk_rec.get("risk_level") or "NORMAL"
    
    # Extract M0.5 primary evidence list
    m05_evidence = intel_rec.get("evidence", [])
    m05_evidence_keys = [e.get("feature") for e in m05_evidence if isinstance(e, dict)]
    
    primary_evidence_items: List[PrimaryEvidenceItem] = []
    for ev in m05_evidence:
        if isinstance(ev, dict) and ev.get("feature"):
            primary_evidence_items.append(
                PrimaryEvidenceItem(
                    feature=ev["feature"],
                    source="M0.5",
                    direction=ev.get("direction"),
                    z_score=ev.get("z_score"),
                    contribution=ev.get("contribution"),
                    semantics="DERIVED_ANALYTICAL"
                )
            )

    # Collect matching rules and evidence chains
    matched_rules = []
    
    # 1. Check persistent/high anomaly (M0.8 risk score >= 70 or HIGH/ELEVATED alert)
    if (risk_score is not None and risk_score >= 70.0) or risk_rec.get("alert") or risk_level in ["HIGH", "ELEVATED"]:
        rule = registry.get("G-PERSISTENT-ANOMALY-003")
        basis_items = [
            EvidenceBasis(source="M0.8", evidence="elevated_fused_risk_score", details=f"score: {risk_score}", semantics="DERIVED_ANALYTICAL"),
            EvidenceBasis(source="M0.5", evidence="intelligence_risk_level", details=f"level: {risk_level}", semantics="DERIVED_ANALYTICAL")
        ]
        matched_rules.append((rule, basis_items, ["Multi-channel risk score is elevated."]))

    # 2. Check Torque / Hookload deviation
    torque_matched = any(k in ["hookload.roll_medium_mean", "hookload.meaningful_change", "hookload_bpos_diff", "torque"] for k in m05_evidence_keys)
    if torque_matched:
        rule = registry.get("G-TORQUE-REVIEW-001")
        basis_items = [
            EvidenceBasis(source="M0.5", evidence=k, details="z-score deviation detected", semantics="DERIVED_ANALYTICAL") for k in m05_evidence_keys if k in ["hookload.roll_medium_mean", "hookload.meaningful_change", "hookload_bpos_diff", "torque"]
        ]
        matched_rules.append((rule, basis_items, ["Torque / Hookload analytical signal deviation detected."]))

    # 3. Check Pressure deviation
    pressure_matched = any(k in ["standpipe_pressure.roll_short_std", "standpipe_pressure.meaningful_change", "roll_medium_sppa_hkld_corr"] for k in m05_evidence_keys)
    if pressure_matched:
        rule = registry.get("G-PRESSURE-REVIEW-002")
        basis_items = [
            EvidenceBasis(source="M0.5", evidence=k, details="z-score deviation detected", semantics="DERIVED_ANALYTICAL") for k in m05_evidence_keys if k in ["standpipe_pressure.roll_short_std", "standpipe_pressure.meaningful_change", "roll_medium_sppa_hkld_corr"]
        ]
        matched_rules.append((rule, basis_items, ["Standpipe pressure analytical signal deviation detected."]))

    # 4. Check developing deviation
    if not matched_rules and risk_score is not None and (risk_score >= 35.0 or intel_rec.get("anomaly_score", 0) >= 35.0):
        rule = registry.get("G-DEVELOPING-DEVIATION-004")
        basis_items = [
            EvidenceBasis(source="M0.5", evidence="developing_statistical_deviation", details=f"score: {intel_rec.get('anomaly_score')}", semantics="DERIVED_ANALYTICAL")
        ]
        matched_rules.append((rule, basis_items, ["Developing statistical deviation observed in baseline z-scores."]))

    # 4b. Check Look-Ahead offset historical risk interval
    look_ahead_rec = snapshot.get("look_ahead") or {}
    if isinstance(look_ahead_rec, dict) and look_ahead_rec.get("status") in ["AHEAD", "CURRENT"]:
        rule = registry.get("G-APPROACHING-HISTORICAL-RISK-007")
        if rule:
            target_evt = look_ahead_rec.get("target_event_id") or "OFFSET_EVENT"
            target_well = look_ahead_rec.get("target_offset_well_id") or "OFFSET_WELL"
            dist_val = look_ahead_rec.get("tvd_ahead_start_ft") or look_ahead_rec.get("md_ahead_start_ft") or 0.0
            basis_items = [
                EvidenceBasis(source="OFFSET_LOOK_AHEAD", evidence=f"event_{target_evt}", details=f"target: {target_well}, dist: {dist_val:.0f} ft", semantics="DERIVED_ANALYTICAL")
            ]
            matched_rules.append((rule, basis_items, [f"Spatially relevant historical risk interval ({target_evt}) in offset {target_well} is {look_ahead_rec.get('status').lower()}."]))


    # 5. Fallback: Normal behavior
    if not matched_rules:
        rule = registry.get("G-NORMAL-BEHAVIOR-005")
        basis_items = [
            EvidenceBasis(source="M0.5", evidence="baseline_consistent", details="z-scores within normal bounds", semantics="DERIVED_ANALYTICAL")
        ]
        matched_rules.append((rule, basis_items, ["All telemetry and analytical signals operating within expected baselines."]))

    # Primary rule is the highest priority matched rule
    primary_rule, primary_basis, primary_obs = matched_rules[0]
    
    # Supporting rules (if multiple matched)
    supporting = []
    for r, b, o in matched_rules[1:]:
        supporting.append({
            "rule_id": r.rule_id,
            "title": r.title,
            "guidance_level": r.guidance_level.value,
            "guidance_text": r.guidance_text,
            "basis": [item.dict() for item in b]
        })
        
    all_obs = primary_obs.copy()
    all_basis = primary_basis.copy()
    
    # Review parameters derived from rule review parameters
    rev_params = primary_rule.review_parameters.copy()
    for r, _, _ in matched_rules[1:]:
        for p in r.review_parameters:
            if p not in rev_params:
                rev_params.append(p)
                
    return GuidanceRecord(
        well_id=well_id,
        timestamp=timestamp,
        data_origin=data_origin,
        guidance_status=GuidanceStatus.AVAILABLE,
        guidance_level=primary_rule.guidance_level,
        title=primary_rule.title,
        summary=primary_rule.guidance_text,
        observations=all_obs,
        basis=all_basis,
        primary_evidence=primary_evidence_items,
        supporting_parameters=supporting_params,
        data_gaps=data_gaps,
        review_parameters=rev_params,
        available_parameters=available_params,
        unavailable_parameters=unavailable_params,
        recommended_review_path=primary_rule.recommended_review_path,
        operational_action=None,  # GUARANTEED NULL for decision support
        limitations=[primary_rule.limitation_text],
        provenance=primary_rule.provenance,
        rule_id=primary_rule.rule_id,
        supporting_guidance=supporting
    )
