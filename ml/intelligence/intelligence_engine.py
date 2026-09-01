"""
ml/intelligence/intelligence_engine.py

NWIS Intelligence Engine — Orchestrator

Pipeline:
    FEATURE RECORD
          ↓
    QUALITY GATE
          ↓
    BASELINE (z_scores computed BEFORE push)
          ↓
    COMPONENT SCORES (anomaly_detector)
          ↓
    QUALITY CAPS (source gap / coverage)
          ↓
    RISK LEVEL + PERSISTENCE (risk_scorer)
          ↓
    EVIDENCE (evidence.py)
          ↓
    INTELLIGENCE RECORD

ORDERING INVARIANT (enforced here, tested in validate_intelligence.py):
    For each record:
        1. Extract MVP values from feature record
        2. Compute z_scores (uses history [0..t-1])
        3. Compute component scores
        4. Push current values into baseline history
    This ensures the current observation never informs its own baseline.

TELEMETRY QUALITY GATE:
    - EMPTY records → SUPPRESSED, no score
    - SOURCE_GAP → DEGRADED, score capped at 40
    - Coverage < 50% → DEGRADED, score capped at 40
    - time_delta_seconds used ONLY here (not in anomaly score weights)

LANGUAGE POLICY:
    Intelligence records describe anomalous signal behaviour.
    They do not claim confirmed drilling events.
"""

import json
import math
from pathlib import Path
from typing import Iterator, List, Optional

from .baseline import RollingBaseline
from .anomaly_detector import (
    _extract_mvp_values,
    compute_component_scores,
    combine_scores,
    FEATURE_WEIGHTS,
)
from .risk_scorer import (
    score_to_level,
    apply_quality_caps,
    compute_confidence,
    PersistenceState,
)
from .evidence import extract_evidence

INTELLIGENCE_VERSION = "0.1.0"
TOTAL_SCOREABLE_FEATURES = len(FEATURE_WEIGHTS)
MIN_COVERAGE_RATIO = 0.50  # below this → low_coverage flag

# time_delta threshold for quality gate only (not used in anomaly score)
ABNORMAL_INTERVAL_SECONDS = 300  # from windows.GAP_THRESHOLD_SEC


def _safe_json(obj):
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: _safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe_json(v) for v in obj]
    return obj


def _suppressed_record(feature_record: dict, reason: str) -> dict:
    """Build a SUPPRESSED intelligence record (no score)."""
    return _safe_json({
        "intelligence_version": INTELLIGENCE_VERSION,
        "timestamp":            feature_record["timestamp"],
        "well_id":              feature_record["well_id"],
        "source_row_index":     feature_record.get("source_row_index"),
        "data_origin":          feature_record["data_origin"],
        "telemetry_status":     feature_record["telemetry_status"],
        "intelligence_status":  "SUPPRESSED",
        "anomaly_score":        None,
        "risk_level":           None,
        "alert":                False,
        "confidence":           None,
        "evidence":             [],
        "quality_flags": {
            "suppressed_empty":        reason == "EMPTY",
            "source_gap_suppression":  False,
            "low_coverage":            False,
            "insufficient_baseline":   False,
            "available_feature_count": 0,
        },
        "baseline_snapshot":    None,
    })


def process_feature_records(
    feature_records: List[dict],
    baseline_window: int = 60,
) -> Iterator[dict]:
    """
    Process a list of M0.4 feature records and yield intelligence records.

    Records must be sorted chronologically (ascending timestamp).

    Parameters
    ----------
    feature_records : list of feature record dicts (M0.4 output)
    baseline_window : rolling window size for baseline history

    Yields
    ------
    dict — intelligence record
    """
    baseline = RollingBaseline(window=baseline_window)
    persistence = PersistenceState()

    for feature_record in feature_records:
        ts_status   = feature_record.get("telemetry_status", "EMPTY")
        quality_f   = feature_record.get("quality_features", {})
        source_gap  = bool(quality_f.get("source_gap_flag", 0))
        time_delta  = quality_f.get("time_delta_seconds")

        # ── QUALITY GATE ──────────────────────────────────────────────────
        # 1. Suppress fully empty records
        if ts_status == "EMPTY":
            yield _suppressed_record(feature_record, "EMPTY")
            continue

        # ── EXTRACT MVP VALUES ────────────────────────────────────────────
        mvp_values = _extract_mvp_values(feature_record)

        # ── BASELINE: z_scores BEFORE push (strict ordering invariant) ───
        z_scores = baseline.z_scores(mvp_values)

        # Check if any feature had insufficient baseline
        any_insufficient = not all(
            baseline.has_sufficient_baseline(k)
            for k in FEATURE_WEIGHTS
        )

        # ── COMPONENT SCORES ──────────────────────────────────────────────
        components = compute_component_scores(z_scores, feature_record)

        # ── PUSH current values into baseline AFTER scoring ───────────────
        baseline.push(mvp_values)

        # ── COMBINE ───────────────────────────────────────────────────────
        raw_score, effective_weight, available_count = combine_scores(components)

        # ── QUALITY CAPS ──────────────────────────────────────────────────
        low_coverage = (available_count / TOTAL_SCOREABLE_FEATURES) < MIN_COVERAGE_RATIO
        capped_score, gap_capped, coverage_capped = apply_quality_caps(
            raw_score, source_gap, low_coverage
        )

        # time_delta used ONLY for additional quality annotation, NOT in score
        abnormal_interval = (
            time_delta is not None and time_delta > ABNORMAL_INTERVAL_SECONDS
        )

        # ── RISK LEVEL + PERSISTENCE ──────────────────────────────────────
        risk_level = score_to_level(capped_score)
        alert      = persistence.update(risk_level)

        # ── CONFIDENCE ────────────────────────────────────────────────────
        confidence = compute_confidence(
            available_count,
            TOTAL_SCOREABLE_FEATURES,
            source_gap,
            any_insufficient,
        )

        # ── EVIDENCE ──────────────────────────────────────────────────────
        evidence = extract_evidence(components, z_scores, capped_score)

        # ── INTELLIGENCE STATUS ───────────────────────────────────────────
        if source_gap or gap_capped or coverage_capped:
            intel_status = "DEGRADED"
        else:
            intel_status = "SCORED"

        # ── BASELINE SNAPSHOT ─────────────────────────────────────────────
        baseline_snapshot = {
            k: round(z_scores[k], 4) if z_scores.get(k) is not None else None
            for k in FEATURE_WEIGHTS
        }

        quality_flags = {
            "suppressed_empty":        False,
            "source_gap_suppression":  gap_capped,
            "low_coverage":            low_coverage,
            "insufficient_baseline":   any_insufficient,
            "available_feature_count": available_count,
            "abnormal_interval":       abnormal_interval,
        }

        record = {
            "intelligence_version": INTELLIGENCE_VERSION,
            "timestamp":            feature_record["timestamp"],
            "well_id":              feature_record["well_id"],
            "source_row_index":     feature_record.get("source_row_index"),
            "data_origin":          feature_record["data_origin"],
            "telemetry_status":     ts_status,
            "intelligence_status":  intel_status,
            "anomaly_score":        round(capped_score, 4),
            "risk_level":           risk_level,
            "alert":                alert,
            "confidence":           confidence,
            "evidence":             evidence,
            "quality_flags":        quality_flags,
            "baseline_snapshot":    baseline_snapshot,
        }

        yield _safe_json(record)


def process_jsonl_file(
    input_path: Path,
    output_path: Path,
    limit: Optional[int] = None,
) -> dict:
    """
    Read M0.4 feature records from JSONL, compute intelligence, write output JSONL.

    Returns a summary dict for well1_intelligence_summary.json.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    records = []
    with open(input_path, encoding="utf-8") as f:
        for i, line in enumerate(f):
            if limit is not None and i >= limit:
                break
            line = line.strip()
            if line:
                records.append(json.loads(line))

    print(f"Loaded {len(records)} feature records. Computing intelligence...")

    level_counts: dict[str, int] = {"NORMAL": 0, "WATCH": 0, "ELEVATED": 0, "HIGH": 0}
    suppressed = 0
    alerts = 0
    all_intel = []

    with open(output_path, "w", encoding="utf-8") as out:
        for intel in process_feature_records(records):
            out.write(json.dumps(intel) + "\n")
            all_intel.append(intel)
            if intel["intelligence_status"] == "SUPPRESSED":
                suppressed += 1
            else:
                lvl = intel.get("risk_level") or "NORMAL"
                level_counts[lvl] = level_counts.get(lvl, 0) + 1
            if intel.get("alert"):
                alerts += 1

    print(f"Written {len(all_intel)} intelligence records to {output_path}")

    # Build summary
    top_anomalies = sorted(
        [r for r in all_intel if r.get("anomaly_score") is not None],
        key=lambda r: -(r["anomaly_score"] or 0),
    )[:5]

    # Top contributing features across non-normal records
    feature_contrib: dict[str, float] = {}
    for r in all_intel:
        for ev in r.get("evidence", []):
            f = ev["feature"]
            feature_contrib[f] = feature_contrib.get(f, 0.0) + ev["contribution"]
    top_features = sorted(feature_contrib.items(), key=lambda x: -x[1])[:5]

    summary = {
        "well_id":          all_intel[0]["well_id"] if all_intel else "unknown",
        "total_records":    len(all_intel),
        "suppressed":       suppressed,
        "scored":           len(all_intel) - suppressed,
        "risk_level_counts": level_counts,
        "alert_count":      alerts,
        "top_anomaly_intervals": [
            {
                "timestamp":     r["timestamp"],
                "source_row_index": r.get("source_row_index"),
                "anomaly_score": r["anomaly_score"],
                "risk_level":    r["risk_level"],
                "evidence":      r["evidence"],
            }
            for r in top_anomalies
        ],
        "top_contributing_features": [
            {"feature": f, "total_contribution": round(c, 4)}
            for f, c in top_features
        ],
        "prototype_note": (
            "Anomaly scores and risk levels are prototype parameters for the NWIS MVP. "
            "They reflect statistical deviation from rolling signal baselines. "
            "They do NOT represent confirmed drilling events."
        ),
    }
    return summary


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent.parent
    feature_full = repo_root / "data" / "processed" / "well1_feature_full.jsonl"
    feature_path = repo_root / "data" / "processed" / "well1_feature_sample.jsonl"
    out_path     = repo_root / "data" / "processed" / "well1_intelligence_sample.jsonl"
    summary_path = repo_root / "data" / "metadata" / "well1_intelligence_summary.json"

    input_path = feature_full if feature_full.exists() else feature_path
    print(f"Reading feature records from: {input_path}")

    summary = process_jsonl_file(input_path, out_path)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Summary written to: {summary_path}")
