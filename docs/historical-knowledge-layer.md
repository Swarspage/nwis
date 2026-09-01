# M0.7 Historical Evidence & Event Alignment Layer

## Overview
Phase M0.7 establishes a provenance-preserving historical evidence layer for the NWIS pipeline. It operates structurally above M0.4 (Features), M0.5 (Deterministic Intelligence), and M0.6 (ML Models).

The core philosophy of this layer is that **historical reports and operational records are treated as source evidence; they are not automatically assumed to be perfect ground truth**. Analytical telemetry evidence (anomaly scores, model states) is kept strictly separate from human-reported historical events unless explicitly verified.

## Architecture & Evidence Hierarchy
M0.7 distinguishes between different levels of evidence to prevent analytical leakage into historical records:
1. **Source Document / Operational Record:** Raw reports (e.g., Daily Drilling Reports, PDF notes).
2. **Historical Event:** Standardized representation in NWIS, preserving explicit provenance, confidence, and `verification_status` (`CONFIRMED`, `POTENTIAL`, `UNVERIFIED`).
3. **Analytical Evidence:** M0.4 features, M0.5 intelligence, and M0.6 models.

M0.7 aligns historical events with analytical evidence windows (`pre_event`, `event_window`, `post_event`) by enforcing strict temporal constraints.

## Schemas
- `nwis_historical_event.schema.json`: Draft-07 schema for standalone events. Requires nullable bounds and robust provenance (extraction method, origin).
- `nwis_knowledge_record.schema.json`: Fused retrospective knowledge record. Contains the event and its associated evidence slices.
- `event_taxonomy.json`: Valid taxonomy mapping containing authorized canonical values (`STUCK_PIPE`, `MUD_LOSS`, etc.).

## Strict Prevention of Leakage
Knowledge records produced by M0.7 are **retrospective analytical objects**. For any future predictive modeling (Phase M0.8+), the dataset compiler must explicitly select permitted temporal windows to avoid look-ahead leakage. M0.7 enforces boundaries where `pre_event` windows cannot contain timestamps `>= event_start`.

## Depth Alignment
Due to constraints in standard raw drilling telemetry, M0.7 requires that depth alignment be classified as `VERIFIED`, `UNVERIFIED`, or `UNAVAILABLE`. Numerical proximity is not calculated when verified continuous depth is missing.

## WELL-1 Limitations
**NO VERIFIED HISTORICAL EVENTS AVAILABLE.**
As established in earlier phases, the `WELL-1.csv` repository lacks authoritative event documentation (e.g., matching daily drilling reports or explicit manual event logs with ground truth). 

In accordance with strict M0.7 rules—"Do not invent physical units or events"—the production `well1_historical_events.jsonl` dataset contains zero records. The M0.7 architecture has been validated using 29 strict in-memory synthetic fixture tests (`validate_knowledge.py`), but no events have been falsely mapped to WELL-1 simply for demonstration.

The knowledge builder safely processes this empty input, yielding an empty `well1_knowledge_sample.jsonl` and a summary diagnostics file explicitly logging the limitation.
