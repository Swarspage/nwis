"""
ml/guidance/rules.py

Rule definitions for the NWIS Engineering Guidance Engine.
Rules map evidence conditions to structured engineering decision-support guidance.
"""

from typing import List
from .schema import GuidanceRuleDefinition, GuidanceLevel
from .provenance import build_heuristic_provenance

RULES: List[GuidanceRuleDefinition] = [
    GuidanceRuleDefinition(
        rule_id="G-PERSISTENT-ANOMALY-003",
        condition="PERSISTENT_ANOMALY",
        guidance_level=GuidanceLevel.INVESTIGATE,
        required_evidence=["m08_risk_score"],
        review_parameters=["torque", "hookload", "standpipe_pressure", "flow_rate", "rate_of_penetration"],
        title="Investigate Persistent Analytical Anomaly",
        guidance_text="Multi-channel analytical indicators show persistent deviation. Investigate telemetry trends across operating parameters and statistical model outputs.",
        limitation_text="Operational parameter changes are not prescribed by the current NWIS guidance layer. Decision support only.",
        provenance=build_heuristic_provenance("NWIS_M08_FUSION_HEURISTICS"),
        recommended_review_path=[
            "1. Review elevated risk timeline and anomaly duration",
            "2. Examine primary driving features from M0.5 Intelligence and M0.6 Models",
            "3. Cross-reference historical offset context if available",
            "4. Engineer conducts comprehensive operational review"
        ]
    ),
    GuidanceRuleDefinition(
        rule_id="G-TORQUE-REVIEW-001",
        condition="TORQUE_DEVIATION",
        guidance_level=GuidanceLevel.REVIEW,
        required_evidence=["hookload_mean", "hookload_change", "hkld_bpos_diff", "torque"],
        review_parameters=["torque", "hookload", "standpipe_pressure", "flow_rate"],
        title="Review Torque & Hookload Behavior",
        guidance_text="Review torque and hookload behavior alongside available standpipe pressure and flow rate trends to evaluate drillstring friction or load changes.",
        limitation_text="Specific WOB or RPM adjustments are not prescribed without validated physical models. Decision support only.",
        provenance=build_heuristic_provenance("NWIS_ANALYTICAL_GUIDANCE"),
        recommended_review_path=[
            "1. Review torque and hookload trend over rolling window",
            "2. Compare hookload response relative to block position movement",
            "3. Review standpipe pressure and flow behavior for hydraulic interaction",
            "4. Review supporting M0.6 model evidence",
            "5. Engineer evaluates drillstring operating state"
        ]
    ),
    GuidanceRuleDefinition(
        rule_id="G-PRESSURE-REVIEW-002",
        condition="PRESSURE_DEVIATION",
        guidance_level=GuidanceLevel.REVIEW,
        required_evidence=["sppa_std", "sppa_change", "standpipe_pressure"],
        review_parameters=["standpipe_pressure", "flow_rate", "torque", "hookload"],
        title="Review Standpipe Pressure Trends",
        guidance_text="Review standpipe pressure behavior alongside flow rate and torque signals to evaluate hydraulic stability and circulating pressure.",
        limitation_text="Specific pump rate adjustments are not prescribed. Decision support only.",
        provenance=build_heuristic_provenance("NWIS_ANALYTICAL_GUIDANCE"),
        recommended_review_path=[
            "1. Review SPP trend and short-term volatility",
            "2. Cross-reference flow rate stability",
            "3. Check torque and rotary speed interaction",
            "4. Engineer evaluates hydraulic response"
        ]
    ),
    GuidanceRuleDefinition(
        rule_id="G-DEVELOPING-DEVIATION-004",
        condition="DEVELOPING_DEVIATION",
        guidance_level=GuidanceLevel.MONITOR,
        required_evidence=["m05_score"],
        review_parameters=["torque", "hookload", "standpipe_pressure"],
        title="Monitor Developing Deviation",
        guidance_text="Analytical evidence indicates a developing statistical deviation. Monitor parameter trends for further progression.",
        limitation_text="Analytical observation only. No operational change indicated at current deviation level.",
        provenance=build_heuristic_provenance("NWIS_ANALYTICAL_GUIDANCE"),
        recommended_review_path=[
            "1. Monitor real-time parameter stability",
            "2. Watch for rising z-scores in key channels",
            "3. Re-evaluate if deviation persists"
        ]
    ),
    GuidanceRuleDefinition(
        rule_id="G-NORMAL-BEHAVIOR-005",
        condition="NORMAL_OPERATING_STATE",
        guidance_level=GuidanceLevel.INFORMATION,
        required_evidence=[],
        review_parameters=["torque", "hookload", "standpipe_pressure", "flow_rate"],
        title="Normal Operating Behavior",
        guidance_text="No immediate engineering attention indicated. Current analytical evidence is consistent with normal operating behavior.",
        limitation_text="None. Telemetry and analytical signals are operating within baseline parameters.",
        provenance=build_heuristic_provenance("NWIS_ANALYTICAL_GUIDANCE"),
        recommended_review_path=[
            "1. Continue routine operational monitoring"
        ]
    ),
    GuidanceRuleDefinition(
        rule_id="G-INSUFFICIENT-EVIDENCE-006",
        condition="INSUFFICIENT_TELEMETRY_EVIDENCE",
        guidance_level=GuidanceLevel.INSUFFICIENT_EVIDENCE,
        required_evidence=[],
        review_parameters=[],
        title="Guidance Unavailable",
        guidance_text="Guidance is currently unavailable due to insufficient supporting telemetry or suppressed analytical evidence.",
        limitation_text="Telemetry completeness is below the required operational threshold for analytical guidance.",
        provenance=build_heuristic_provenance("NWIS_QUALITY_GATE"),
        recommended_review_path=[
            "1. Check telemetry stream quality and sensor coverage",
            "2. Verify data ingestion integrity"
        ]
    )
]
